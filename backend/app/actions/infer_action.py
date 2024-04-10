from backend.app.table_representation.openai_client import OpenAIClient
from backend.app.utils import format_prompt
from pydantic import BaseModel

# Initialize OpenAI client
openai_client = OpenAIClient()

# Craft action inference prompt
PROMPT_ACTION_INFER = """
Given two queries in a search session, decide whether the new query is a "reset" or a "refine" in relation to the previous query.
- A "reset" means the new query significantly differs from the previous query, indicating a change in the search domain or interest.
- A "refine" means the new query builds upon or slightly alters the previous query, indicating a more focused search based on the earlier query.

Previous query: "{prev_query}"
Current query: "{cur_query}"

Should the search space be reset or refined?
"""

# Craft mentioned metadata fields inference prompt
# TODO: For the generated sql clause, need to further check its validity
PROMPT_METADATA_INFER = """
Analyze the user's current query to determine which metadata fields are being referenced. Consider the query's context and specifics to identify relevant metadata fields.
Only focus on the fields that are directly mentioned or implied by the query.

Metadata fields of interest include:
- Table Name
- Column Numbers
- Popularity
- Temporal Granularity
- Geographic Granularity

Note: The query may also refer to other aspects, such as Table Schema, Example Records, Table Description, Table Tags, or Previous Queries, but these do not require SQL WHERE clause generation.

Based on the analysis, if any of the primary metadata fields [Table Name, Column Numbers, Popularity, Temporal Granularity, Geographic Granularity] are mentioned, outline the SQL WHERE clause conditions that would refine the search according to the user's intent.

Current user query: "{cur_query}"

Please provide your analysis, including identified metadata fields and, if applicable, the corresponding SQL WHERE clause conditions in a clear and concise manner.

For instance, if a user's query mentions wanting datasets with information from after the year 2020, the mentioned metadata fields should be "Temporal Granularity", and the SQL WHERE clause condition should be "year > 2020".
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
