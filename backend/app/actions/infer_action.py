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

PROMPT_FILTER_INFER = """
## Instructions:
Given the user's filters, analyze and determine which fields are being referenced in the schema for a SELECT query. Your output should be a list.
Current user filter:
{filters}

## Steps for Analysis:
Identify the field(s) referenced in the filter. The field is the column name used for comparison (e.g., col_num, table_name).
Identify the operator(s) used in the filter. The operator is the operator that compares the field to the parameter (e.g., >, <, =, BETWEEN).
Identify the parameter(s). The parameter is the value used in the comparison (e.g., 5, 10, or 0).

## Examples:
# If the filter is "col_num > 5":
Field = col_num
Operator = >
Parameter = 5

# If the filter is "0 < col_num < 10", it should be treated as two separate conditions:
Field = col_num
Operator = <
Parameter = 0
AND:
Field = col_num
Operator = <
Parameter = 10

## Output
Return only a list, with each element containing a dictionary of the fields, operators, and parameters that are directly referenced by the user's filter.
"""

# TODO: For the generated sql clause, need to further check its validity
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

class FilterClause(BaseModel):
    field: str
    clause: str
    parameter: int

class TextToSQL(BaseModel):
    sql_clauses: List[SQLClause]
class TaskReasonListResponse(BaseModel):
    tasks: List[Dict[str, str]]

def prune_query(text):
    messages = [ 
        {"role": "system", "content": "You are an assistant skilled in pruning messages to retain only the most relevant information for dataset search tasks. Remove unnecessary phrases, such as 'I want' or 'dataset' and focus on key elements like the task type and specific requirements."
        },
        {"role": "user", "content": text}
        ]
    return openai_client.infer_metadata_wo_instructor(messages)


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
    print(cur_query)
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

def filters_to_sql(cur_query, filters):
    try: 
        prompt = format_prompt(PROMPT_FILTER_INFER, cur_query=cur_query, filters=filters)
        response_model = FilterClause
        messages = [
            {"role": "system", "content": "You are an assistant skilled in text to SQL translation, and designed to output a list."},
            {"role": "user", "content": prompt}
        ]

        return openai_client.infer_metadata_wo_instructor(messages)

    except Exception as e:
        logging.error(f"Failed to translate filter to SQL: {e}")
        raise RuntimeError("Failed to process the SQL translation.") from e

def execute_sql(text_to_sql_instance, search_space):

    field_to_column_mapping = {
        'table_name': 'table_name',
        'column_numbers': 'col_num',
        'popularity': 'popularity',
        'temporal_granularity': 'time_granu',
        'geographic_granularity': 'geo_granu'
    }

    with DatabaseConnection() as db:
        # Base query with initial WHERE condition for the search space
        query_base = sql.SQL("SELECT DISTINCT table_name, popularity, db_description, tags, col_num, time_granu, geo_granu, comb_embed, query_embed FROM eval_final_all_with_descriptions WHERE table_name = ANY(%s)")
        where_conditions = []  # List to hold additional conditions
        logging.info(where_conditions)
        ordering = []  # List to hold ORDER BY conditions
        logging.info(ordering)

        parameters = [search_space]  # List to hold all parameters for the SQL query

        for clause in text_to_sql_instance.sql_clauses:
            db_field = field_to_column_mapping.get(clause.field.lower())
            if not db_field:
                logging.warning(f"Error with the raw metadata field inference: {clause.field}")
                continue

            if 'ORDER BY' in clause.clause:
                parts = clause.clause.split()
                direction = parts[-1]  # Assumes format "ORDER BY field_name DESC/ASC"
                ordering.append(sql.SQL("{} {}").format(sql.Identifier(db_field), sql.SQL(direction)))
            else:
                operator, value = clause.clause.split(' ', 1)
                value = value.strip("'").lower()  # Strip quotes and convert to lowercase
                if db_field in ['time_granu', 'geo_granu']:
                    # Using unnest to compare elements in an array field
                    condition = sql.SQL("EXISTS (SELECT 1 FROM unnest({}) AS elem WHERE elem {} %s)").format(
                        sql.Identifier(db_field), sql.SQL(operator))
                    where_conditions.append(condition)
                    parameters.append(value)  # Add value to parameters list
                else:
                    condition = sql.SQL("{} {} %s").format(sql.Identifier(db_field), sql.SQL(operator))
                    where_conditions.append(condition)
                    parameters.append(value)  # Add value to parameters list

        # Combine additional WHERE conditions and ORDER BY clauses into the base query
        if where_conditions:
            query_base = query_base + sql.SQL(" AND ") + sql.SQL(" AND ").join(where_conditions)
        if ordering:
            query_base = query_base + sql.SQL(" ORDER BY ") + sql.Composed(ordering)

        logging.info("🏃Executing query: %s", query_base.as_string(db.conn))

        # Execute the query
        try:
            db.cursor.execute(query_base, parameters)  # Pass the parameters list
            results = db.cursor.fetchall()
            return results
        except Exception as e:
            logging.error(f"SQL execution failed, Error: {e}")
            return []
        
def execute_metadata_sql(sql_clauses, search_space):
    with DatabaseConnection() as db:
        # Base query with initial WHERE condition for the search space
        query_base = sql.SQL("SELECT DISTINCT * FROM eval_final_all_with_descriptions WHERE table_name = ANY(%s)")
        where_conditions = []  # List to hold additional conditions
        parameters = [search_space]  # List to hold all parameters for the SQL query

        for clause in sql_clauses:
            db_field, operator, value = clause['Field'], clause['Operator'], clause['Parameter']
            if db_field in ['time_granu', 'geo_granu']:
                # Using unnest to compare elements in an array field
                condition = sql.SQL("EXISTS (SELECT 1 FROM unnest({}) AS elem WHERE elem {} %s)").format(
                    sql.Identifier(db_field), sql.SQL(operator))
                where_conditions.append(condition)
                parameters.append(value)  # Add value to parameters list
            else:
                condition = sql.SQL("{} {} %s").format(sql.Identifier(db_field), sql.SQL(operator))
                where_conditions.append(condition)
                parameters.append(value)  # Add value to parameters list

        # Combine additional WHERE conditions and ORDER BY clauses into the base query
        if where_conditions:
            query_base = query_base + sql.SQL(" AND ") + sql.SQL(" AND ").join(where_conditions)
       
        logging.info("🏃Executing query: %s", query_base.as_string(db.conn))

        # Execute the query
        try:
            db.cursor.execute(query_base, parameters)  # Pass the parameters list
            results = db.cursor.fetchall()
            return results
        except Exception as e:
            logging.error(f"SQL execution failed, Error: {e}")
            return []
        
def execute_metadata_sql(db_field, operator, value, search_space):
    with DatabaseConnection() as db:
        # Base query with initial WHERE condition for the search space
        query_base = sql.SQL("SELECT DISTINCT * FROM eval_final_all_with_descriptions WHERE table_name = ANY(%s)")
        where_conditions = []  # List to hold additional conditions
        parameters = [search_space]  # List to hold all parameters for the SQL query

        condition = sql.SQL("{} {} %s").format(sql.Identifier(db_field), sql.SQL(operator))
        where_conditions.append(condition)
        parameters.append(value)  # Add value to parameters list

        # Combine additional WHERE conditions and ORDER BY clauses into the base query
        if where_conditions:
            query_base = query_base + sql.SQL(" AND ") + sql.SQL(" AND ").join(where_conditions)
       
        logging.info("🏃Executing query: %s", query_base.as_string(db.conn))

        # Execute the query
        try:
            db.cursor.execute(query_base, parameters)  # Pass the parameters list
            results = db.cursor.fetchall()
            return results
        except Exception as e:
            logging.error(f"SQL execution failed, Error: {e}")
            return []