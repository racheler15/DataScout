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

@app.route('/api/get_chat_history', methods=['GET'])
def get_chat_history():
    # Extract thread_id from the request's query parameters
    thread_id = request.args.get('thread_id')
    
    # Check if thread_id is provided and valid
    if thread_id and thread_id in chat_history:
        # Return the chat history for the given thread_id
        return jsonify({
            "success": True,
            "thread_id": thread_id,
            "chat_history": chat_history[thread_id]
        })
    else:
        # Return an error message if thread_id is not provided or invalid
        return jsonify({
            "success": False,
            "error": "Invalid or missing thread_id"
        }), 400

@app.route('/api/update_chat_history', methods=['POST'])
def update_chat_history():
    data = request.get_json()
    thread_id = data.get('thread_id')
    query = data.get('query')

    # Validate thread_id and query presence
    if not thread_id or thread_id not in chat_history:
        return jsonify({"success": False, "error": "Invalid or missing thread_id"}), 400
    if not query:
        return jsonify({"success": False, "error": "Missing query content"}), 400

    try:
        # Append the user query to the chat history
        chat_history[thread_id].append({"sender": "user", "text": query})

        logging.info(f"Current chat history: {chat_history}")
        return jsonify({
                "success": True,
                "thread_id": thread_id,
                "chat_history": chat_history[thread_id]
        })
    except Exception as e:
        logging.error(f"Update chat history failed for thread: {thread_id}, Error: {e}")
        return jsonify({"error": "Update chat history failed due to an internal error"}), 500

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
