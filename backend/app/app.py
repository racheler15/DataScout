from flask import Flask, request, jsonify
from flask_cors import CORS
from uuid import uuid4
import logging
from backend.app.table_representation.openai_client import OpenAIClient
from backend.app.hyse.hypo_schema_search import hyse_search
from backend.app.actions.infer_action import infer_action, infer_mentioned_metadata_fields, text_to_sql, execute_sql
from backend.app.actions.handle_action import handle_semantic_fields, handle_raw_fields

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
        # Identify metadata fields
        # TODO: Make sure for user's initial query, mention_semantic_fields is always True
        semantic_fields_identified = infer_mentioned_metadata_fields(cur_query=query, semantic_metadata=True).get_true_fields()
        raw_fields_identified = infer_mentioned_metadata_fields(cur_query=query, semantic_metadata=False).get_true_fields()

        # Update chat history with additional metadata field information
        chat_history[thread_id].append({
            "sender": "user",
            "text": query,
            "mention_semantic_fields": bool(semantic_fields_identified),
            "mention_raw_fields": bool(raw_fields_identified)
        })

        logging.info(f"💬 Current chat history: {chat_history}")
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
        response_data = {
            "top_results": initial_results[:10]
        }
        logging.info(f"✅Search successful for query: {initial_query}")
        return jsonify(response_data), 200
    except Exception as e:
        logging.error(f"Search failed for query: {initial_query}, Error: {e}")
        return jsonify({"error": "Search failed due to an internal error"}), 500

@app.route('/api/refine_search_space', methods=['POST'])
def refine_search_space():
    thread_id = request.get_json().get('thread_id')

    # Validate thread_id and query presence
    if not thread_id or thread_id not in chat_history:
        return jsonify({"success": False, "error": "Invalid or missing thread_id"}), 400
    
    try:
        # Initialize defaults
        refined_semantic_results, inferred_semantic_fields, inferred_raw_fields = [], [], []

        # Get user current and previous queries
        cur_chat_history = chat_history[thread_id]
        cur_query, prev_query = cur_chat_history[-1]["text"], cur_chat_history[-2]["text"]

        # Check if the current query mentions semantic / raw metadata fields
        mention_semantic_fields, mention_raw_fields = cur_chat_history[-1]["mention_semantic_fields"], cur_chat_history[-1]["mention_raw_fields"]

        # Step 1: Determine action (reset / refine) based on query delta
        inferred_action = infer_action(cur_query=cur_query, prev_query=prev_query)
        logging.info(f"✅Inferred action for current query '{cur_query}' and previous query '{prev_query}': {inferred_action.model_dump()}")

        # Neither reset nor refine: error with LLM inference
        # TODO: implement retry mechanism
        if not inferred_action.reset and not inferred_action.refine:
            logging.error(f"Action inference failed: neither action was identified")
            return jsonify({"error": "Action inference failed"}), 500
        
        # Step 2.1: If RESET - restore last search results
        if inferred_action.reset:
            pass
        
        # Step 2.2: If REFINE
        # Step 3.1: Handle mentioned SEMANTIC metadata fields in user current query
        if mention_semantic_fields:
            # Identify mentioned semantic metadata fields
            inferred_semantic_fields = infer_mentioned_metadata_fields(cur_query=cur_query, semantic_metadata=True).get_true_fields()
            logging.info(f"✅Inferred mentioned semantic metadata fields for current query '{cur_query}': {inferred_semantic_fields}")

            refined_semantic_results = handle_semantic_fields(chat_history, thread_id)

        # Step 3.2: Handle mentioned RAW metadata fields in user current query
        if mention_raw_fields:
            # Identify mentioned raw metadata fields
            inferred_raw_fields = infer_mentioned_metadata_fields(cur_query=cur_query, semantic_metadata=False).get_true_fields()
            logging.info(f"✅Inferred mentioned raw metadata fields for current query '{cur_query}': {inferred_raw_fields}")
            
            refined_results = handle_raw_fields(cur_query, inferred_raw_fields)
            logging.info(f"✅Result tables after raw metadata filtering: {refined_results}")

        # Package the response with additional information from the second message onwards
        response_data = {
            "top_results": refined_semantic_results[:10],
            "inferred_action": inferred_action.get_true_fields(),
            "mention_semantic_fields": inferred_semantic_fields,
            "mention_raw_fields": inferred_raw_fields,
        }

        return jsonify(response_data), 200
        
    except Exception as e:
        logging.error(f"Search refinement failed, Error: {e}")
        return jsonify({"error": "Search refinement failed due to an internal error"}), 500

if __name__ == '__main__':
    app.run(debug=True)
