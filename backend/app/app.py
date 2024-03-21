from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
from backend.app.table_representation.openai_client import OpenAIClient
from backend.app.hyse.hypo_schema_search import hyse_search

# Flask app configuration
app = Flask(__name__)
CORS(app)

# OpenAI client instantiation
openai_client = OpenAIClient()
# Set up a single assistant for all threads
assistant_id = None  
ASSISTANT_NAME = "Semantic Dataset Search"
# TODO: further craft the assistant's instructions
ASSISTANT_INSTRU = """
    You are an AI assistant designed to aid users in locating specific datasets relevant to their analytical tasks. 
    Your responses and actions are guided by user queries, aiming to streamline the search process and deliver precise results. 
    Here's how you should operate:

    1. Initial Interaction:
    For the first message from a user, always reply with: "Here are the initial possible results according to your query."

    2. Subsequent Interactions:
    From the second message onwards, carefully analyze the user's input to determine whether they wish to "reset" or "refine" their current search. 
    To do this, compare the new message with the previous one to understand the user's intent and the criteria for modification.

    3. Metadata Fields Consideration:
    Identify which metadata fields need to be reset or refined based on the user's latest input. 
    Only include relevant fields in the analysis. These fields may include:
        Table Name
        Table Schema
        Example Records
        Table Description
        Table Tags
        Column Numbers
        Previous Queries
        Temporal Granularity
        Geographic Granularity
        Popularity
    
    4. Query Processing:
    If the identified metadata fields are among [Table Name, Column Numbers, Popularity, Temporal Granularity, Geographic Granularity], 
    convert the text to SQL for precise database queries.
    
    5. Response Formatting:
    Format the response as a JSON object: {"reset": true/false, "refine": true/false, "mentioned_metadata_fields": [list of user-mentioned metadata fields], "where_clauses": [list of inferred where clauses]}. 
"""

# Logging configuration
logging.basicConfig(level=logging.INFO)


@app.route('/api/start_chat', methods=['POST'])
def start_conversation():
    global assistant_id
    if not assistant_id:
        # Create or fetch an existing assistant id
        assistant = openai_client.create_assistant(
            name=ASSISTANT_NAME,
            instructions=ASSISTANT_INSTRU
        )
        assistant_id = assistant.id
    thread = openai_client.create_thread()
    return jsonify({"thread_id": thread.id, "assistant_id": assistant_id})

@app.route('/api/hyse_search', methods=['POST'])
def initial_search():
    initial_query = request.json.get('query')

    if not initial_query or len(initial_query.strip()) == 0:
        logging.error("Empty query provided")
        return jsonify({"error": "No query provided"}), 400

    try:
        initial_results = hyse_search(initial_query)
        logging.info(f"Search successful for query: {initial_query}")
        return jsonify(initial_results), 200
    except Exception as e:
        logging.error(f"Search failed for query: {initial_query}, Error: {e}")
        return jsonify({"error": "Search failed due to an internal error"}), 500

# @app.route('/api/query_sim_search', methods=['POST'])

# @app.route('/api/reset_search_space', methods=['POST'])

# @app.route('/api/prune_search_space', methods=['POST'])
# def prune_search_space():
#     query = request.json.get('query')
#     thread_id = request.json.get('thread_id')

#     # Create a message in the thread
#     openai_client.create_message(thread_id, "user", query)
#     # Run the thread with the assistant
#     response = openai_client.run_thread(thread_id, assistant_id)
#     return jsonify({"response": response})

if __name__ == '__main__':
    app.run(debug=True)
