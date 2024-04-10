from backend.app.table_representation.openai_client import OpenAIClient
from backend.app.utils import format_prompt
from pydantic import BaseModel

# Initialize OpenAI client
openai_client = OpenAIClient()

# Craft action inference prompt
PROMPT = """
Given two queries in a search session, decide whether the new query is a "reset" or a "refine" in relation to the previous query.
- A "reset" means the new query significantly differs from the previous query, indicating a change in the search domain or interest.
- A "refine" means the new query builds upon or slightly alters the previous query, indicating a more focused search based on the earlier query.

Previous query: "{prev_query}"
Current query: "{cur_query}"

Should the search space be reset or refined?
"""

# Define desired output structure
class Action(BaseModel):
    reset: bool
    refine: bool

    def to_dict(self):
        return {"reset": self.reset, "refine": self.refine}

def infer_action(cur_query, prev_query):
    prompt = format_prompt(PROMPT, cur_query=cur_query, prev_query=prev_query)

    response_model = Action

    messages = [
        {"role": "system", "content": "You are an assistant skilled in search related decision making."},
        {"role": "user", "content": prompt}
    ]

    return openai_client.infer_metadata(messages, response_model)
