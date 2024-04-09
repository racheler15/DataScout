from flask import Flask, request, jsonify
from flask_cors import CORS
from uuid import uuid4
import logging
from backend.app.table_representation.openai_client import OpenAIClient
from backend.app.hyse.hypo_schema_search import hyse_search

# Flask app configuration
app = Flask(__name__)
CORS(app)

# OpenAI client instantiation
openai_client = OpenAIClient()

# Logging configuration
logging.basicConfig(level=logging.INFO)

# In-memory storage for chat history
# TODO: Use server-side session to store chat histories
chat_history = {}

@app.route('/api/start_chat', methods=['POST'])
def start_new_chat_session():
    # Generate a unique session/thread ID
    thread_id = str(uuid4())
    # Initialize the chat history for this thread
    chat_history[thread_id] = []
    # Return the thread_id to the client
    return jsonify({"thread_id": thread_id})

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


if __name__ == '__main__':
    app.run(debug=True)
