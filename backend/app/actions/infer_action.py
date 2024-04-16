from backend.app.table_representation.openai_client import OpenAIClient
from backend.app.utils import format_prompt
from pydantic import BaseModel

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

# Craft mentioned metadata fields inference prompt
# TODO: For the generated sql clause, need to further check its validity
PROMPT_SEMANTIC_METADATA_INFER = """
Given the user's current query, analyze and determine which fields are being referenced. These fields include:
- Table Schema
- Example Records
- Table Description
- Table Tags

Current user query: "{cur_query}"

Identify any raw metadata fields that are explicitly mentioned or implied by the query. Provide a concise list of these fields.
"""

PROMPT_RAW_METADATA_INFER = """
Given the user's current query, analyze and determine which fields are being referenced. These fields include:
- Table Name
- Column Numbers
- Popularity
- Temporal Granularity
- Geographic Granularity

Current user query: "{cur_query}"

Identify any raw metadata fields that are explicitly mentioned or implied by the query. Provide a concise list of these fields.
"""

PROMPT_SQL_TRANSLATION = """
Given a list of previously identified fields from the user's query, generate SQL WHERE clause conditions that align with the user's search intentions. This task focuses on translating these field references into SQL queries.

Identified fields: [{identified_fields}]
Current user query: "{cur_query}"

For each identified metadata field, create the corresponding SQL WHERE clause condition. Ensure the translation reflects any specific conditions mentioned in the query, such as precise dates, numerical ranges, or other descriptive qualifiers.

For example, if "Temporal Granularity" is identified and the user specifies interest in data from after the year 2020, you should generate the SQL WHERE clause as follows:
- Field: Temporal Granularity
- SQL WHERE Clause: "year > 2020"

List the SQL WHERE clauses for each identified metadata field in a structured and clear format.
"""


# Define desired output structure
class Action(BaseModel):
    reset: bool
    refine: bool

class MentionedMetadata(BaseModel):
    metadata_fields: list[str]
    conditions: list[str]


def infer_action(cur_query, prev_query):
    prompt = format_prompt(PROMPT_ACTION_INFER, cur_query=cur_query, prev_query=prev_query)

    response_model = Action

    messages = [
        {"role": "system", "content": "You are an assistant skilled in search related decision making."},
        {"role": "user", "content": prompt}
    ]

    return openai_client.infer_metadata(messages, response_model)

def infer_mentioned_metadata_fields(cur_query):
    prompt = format_prompt(PROMPT_METADATA_INFER, cur_query=cur_query)

    response_model = MentionedMetadata

    messages = [
        {"role": "system", "content": "You are an assistant skilled in search related decision making."},
        {"role": "user", "content": prompt}
    ]

    return openai_client.infer_metadata(messages, response_model)
