from flask import Flask, request, jsonify
import logging
from backend.app.hyse.hypo_schema_search import hyse_search

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)


@app.route('/')
def index():
    return

@app.route('/api/hyse_search', methods=['POST'])
def initial_search():
    request_data = request.json
    initial_query = request_data.get('query')

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
