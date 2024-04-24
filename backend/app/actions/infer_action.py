from backend.app.table_representation.openai_client import OpenAIClient
from backend.app.utils import format_prompt
from pydantic import BaseModel
from typing import List, Dict
import logging
from backend.app.db.connect_db import DatabaseConnection
from psycopg2 import sql

# Initialize OpenAI client
openai_client = OpenAIClient()

# Craft action inference prompt
PROMPT_ACTION_INFER = """
Given two queries in a search session, decide whether the new query is a "reset" or a "refine" in relation to the previous query.
- A "reset" means the new query significantly differs from the previous query, indicating a change in the analytical task focus.
- A "refine" means the new query builds upon or slightly alters the previous query, indicating a more focused analytical task based on the earlier query.

Previous query: "{prev_query}"
Current query: "{cur_query}"

Should the search space be reset or refined?
"""

# TODO: Add examples in prompt to facilitate the metadata inference
# Craft mentioned metadata fields inference prompt
PROMPT_SEMANTIC_METADATA_INFER = """
Given the user's current query, analyze and determine which fields are being referenced. These fields include:
- Table Schema
- Example Records
- Table Description
- Table Tags

Current user query: "{cur_query}"

Identify any fields that are explicitly mentioned or strongly implied. Provide your analysis as a structured output listing only those fields that are directly related to the query.
"""

PROMPT_RAW_METADATA_INFER = """
Given the user's current query, analyze and determine which fields are being referenced. These fields include:
- Table Name
- Column Numbers
- Popularity
- Temporal Granularity
- Geographic Granularity

Current user query: "{cur_query}"

Identify any fields that are explicitly mentioned or strongly implied. Provide your analysis as a structured output listing only those fields that are directly related to the query.
"""

# TODO: For the generated sql clause, need to further check its validity
# PROMPT_SQL_TRANSLATION = """
# Given the identified fields from the user's query that require SQL translation, generate appropriate SQL WHERE clause conditions. This task focuses on converting these field references into precise SQL queries.

# Identified fields: {identified_fields}
# Current user query: "{cur_query}"

# For each identified metadata field, create the corresponding SQL WHERE clause condition. Ensure the translation reflects any specific conditions mentioned in the query, such as precise dates, numerical ranges, or other descriptive qualifiers.

# The temporal granularity should be chosen from Year, Quarter, Month, Week, Day, Hour, Minute, or Second. The geographical granularity should be chosen from Continent, Country, State/Province, County/District, City, or Zip Code/Postal Code.

# For example, if the fields 'Temporal Granularity' and 'Geographic Granularity' are identified in user's query 'I only want data in United States after 2020', the WHERE clause for temporal_granularity might be "= 'year'", and the clause for geographic_granularity might be "= 'country'".
# """

PROMPT_SQL_TRANSLATION = """
Given the identified fields from the user's query requiring SQL translation, generate appropriate SQL WHERE clause conditions. This task involves converting these field references into precise SQL queries, adhering strictly to predefined granularity levels.

Identified fields: {identified_fields}
Current user query: "{cur_query}"

For each identified metadata field, create the corresponding SQL WHERE clause condition to exactly match the predefined granularity levels.

The temporal granularity should always be referenced specifically as one of the following: Year, Quarter, Month, Week, Day, Hour, Minute, or Second. The geographical granularity should be one of the following: Continent, Country, State/Province, County/District, City, or Zip Code/Postal Code.

For example, if the fields 'Temporal Granularity' and 'Geographic Granularity' are identified in the user's query 'I only want data in the United States after 2020', the WHERE clause for temporal granularity might be "= 'year'" and for geographic granularity should be "= 'country'".
"""


# Define desired output structure
class Action(BaseModel):
    reset: bool
    refine: bool

    def get_true_fields(self):
        return [field for field, value in self.model_dump().items() if value]

class MentionedSemanticFields(BaseModel):
    table_schema: bool
    example_records: bool
    table_description: bool
    table_tags: bool

    def get_true_fields(self):
        return [field for field, value in self.model_dump().items() if value]

class MentionedRawFields(BaseModel):
    table_name: bool
    column_numbers: bool
    popularity: bool
    temporal_granularity: bool
    geographic_granularity: bool

    def get_true_fields(self):
        return [field for field, value in self.model_dump().items() if value]

class SQLClause(BaseModel):
    field: str
    clause: str

class TextToSQL(BaseModel):
    sql_clauses: List[SQLClause]


def infer_action(cur_query, prev_query):
    try:
        prompt = format_prompt(PROMPT_ACTION_INFER, cur_query=cur_query, prev_query=prev_query)

        response_model = Action

        messages = [
            {"role": "system", "content": "You are an assistant skilled in search related decision making."},
            {"role": "user", "content": prompt}
        ]

        return openai_client.infer_metadata(messages, response_model)
    except Exception as e:
        logging.error(f"Failed to infer reset/refine action: {e}")
        raise RuntimeError("Failed to process the action inference.") from e

def infer_mentioned_metadata_fields(cur_query, semantic_metadata=True):
    try:
        if semantic_metadata:
            prompt = format_prompt(PROMPT_SEMANTIC_METADATA_INFER, cur_query=cur_query)
            response_model = MentionedSemanticFields
        else:
            prompt = format_prompt(PROMPT_RAW_METADATA_INFER, cur_query=cur_query)
            response_model = MentionedRawFields
        
        messages = [
            {"role": "system", "content": "You are an assistant skilled in search related decision making"},
            {"role": "user", "content": prompt}
        ]

        return openai_client.infer_metadata(messages, response_model)
    except Exception as e:
        logging.error(f"Failed to infer metadata fields: {e}")
        raise RuntimeError("Failed to process the metadata inference.") from e

def text_to_sql(cur_query, identified_fields):
    try:
        prompt = format_prompt(PROMPT_SQL_TRANSLATION, cur_query=cur_query, identified_fields=identified_fields)

        response_model = TextToSQL

        messages = [
            {"role": "system", "content": "You are an assistant skilled in text to SQL translation, and designed to output JSON."},
            {"role": "user", "content": prompt}
        ]

        return openai_client.infer_metadata(messages, response_model)
    except Exception as e:
        logging.error(f"Failed to translate text to SQL: {e}")
        raise RuntimeError("Failed to process the SQL translation.") from e

def execute_sql(text_to_sql_instance):
    field_to_column_mapping = {
        'table_name': 'table_name',
        'column_numbers': 'col_num',
        'popularity': 'popularity',
        'temporal_granularity': 'time_granu',
        'geographic_granularity': 'geo_granu'
    }

    with DatabaseConnection() as db:
        # Include popularity in the SELECT list if ordering by popularity
        query_base = sql.SQL("SELECT DISTINCT table_name, popularity FROM corpus_raw_metadata_with_embedding")
        where_conditions = []
        ordering = []

        for clause in text_to_sql_instance.sql_clauses:
            db_field = field_to_column_mapping.get(clause.field.lower())
            if not db_field:
                logging.warning(f"Error with the raw metadata field inference: {clause.field}")
                continue

            if clause.field == 'popularity' and 'ORDER BY' in clause.clause:
                # Handling ORDER BY popularity
                ordering.append(sql.SQL("{} DESC").format(sql.Identifier(db_field)))
            elif ' ' in clause.clause:
                operator, value = clause.clause.split(' ', 1)
                value = value.strip("'").lower()  # Strip quotes and convert to lowercase
                if db_field in ['time_granu', 'geo_granu']:
                    # Using unnest to compare elements in an array field
                    condition = sql.SQL("EXISTS (SELECT 1 FROM unnest({}) AS elem WHERE elem {} {})").format(
                        sql.Identifier(db_field), sql.SQL(operator), sql.Literal(value))
                    where_conditions.append(condition)
                else:
                    where_conditions.append(sql.SQL("{} {}").format(sql.Identifier(db_field), sql.SQL(clause.clause)))
            else:
                logging.warning(f"Incomplete SQL clause for field {clause.field}: {clause.clause}")
                continue

        if where_conditions:
            query_base += sql.SQL(" WHERE ") + sql.SQL(" AND ").join(where_conditions)
        if ordering:
            query_base += sql.SQL(" ORDER BY ") + sql.SQL(", ").join(ordering)

        logging.info("🏃Executing query: %s", query_base.as_string(db.conn))

        try:
            db.cursor.execute(query_base)
            result = db.cursor.fetchall()
            return result
        except Exception as e:
            logging.error(f"Failed to execute query: {e}")
            return []