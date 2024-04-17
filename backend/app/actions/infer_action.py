from backend.app.table_representation.openai_client import OpenAIClient
from backend.app.utils import format_prompt
from pydantic import BaseModel
from typing import List, Dict
import logging

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
PROMPT_SQL_TRANSLATION = """
Given the identified fields from the user's query that require SQL translation, generate appropriate SQL WHERE clause conditions. This task focuses on converting these field references into precise SQL queries.

Identified fields: {identified_fields}
Current user query: "{cur_query}"

For each identified metadata field, create the corresponding SQL WHERE clause condition. Ensure the translation reflects any specific conditions mentioned in the query, such as precise dates, numerical ranges, or other descriptive qualifiers.
"""


# Define desired output structure
class Action(BaseModel):
    reset: bool
    refine: bool

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