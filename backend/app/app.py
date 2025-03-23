from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from uuid import uuid4
import logging
from backend.app.table_representation.openai_client import OpenAIClient
from backend.app.hyse.hypo_schema_search import hyse_search, most_popular_datasets, get_datasets, hnsw_search
from backend.app.actions.infer_action import infer_action, infer_mentioned_metadata_fields, prune_query, TaskReasonListResponse
from backend.app.actions.handle_action import handle_semantic_fields, handle_raw_fields, handle_raw_filters
from backend.app.chat.handle_chat_history import append_user_query, append_system_response, get_user_queries, get_last_results, get_mentioned_fields
from backend.app.db.table_schema import table_schema_dict, table_schema_dict_frontend, metadata_filtering_operations, metadata_values, metadata_descriptions

import json
import ast
import os
import time
import asyncio
import threading
import queue
from typing import List, Dict, Any
import autogen
from autogen import AssistantAgent, UserProxyAgent, GroupChat, GroupChatManager, ConversableAgent, Agent
from autogen import register_function
from collections import Counter
import matplotlib.pyplot as plt
import re
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics.pairwise import cosine_similarity
from thefuzz import fuzz, process


# Flask app configuration
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:5174", "http://localhost:5173"]}})

chat_status = "ended"

# Queues for single-user setup
print_queue = queue.Queue()
user_queue = queue.Queue()
task_query = ""
metadata_filters = []

# OpenAI client instantiation
openai_client = OpenAIClient()

# Logging configuration
logging.basicConfig(level=logging.INFO)

# In-memory storage for chat history
# TODO: Use server-side session to store chat histories
chat_history = {}

llm_config = {
    "config_list": [
        {"model": "gpt-4o-mini", "api_key": os.environ.get('OPENAI_API_KEY')}
    ]
}


# https://www.youtube.com/watch?v=4mO2TmDervU&ab_channel=YeyuLab

#########
# When start chat session, create a new thread (conversation session between an Assistant and a user).
#########
@app.route('/api/start_chat', methods=['POST']) #post = submitting data ==> creating a new chat session
def start_new_chat_session():
    logging.info(f"starting new chat session")
    # Generate a unique session/thread ID
    thread_id = str(uuid4())
    # Initialize the chat history for this thread; messages stored as list
    chat_history[thread_id] = []
    # Return the thread_id to the client
    return jsonify({"thread_id": thread_id})


@app.route('/api/get_chat_history', methods=['GET'])
def get_chat_history():
    logging.info(f"getting chat history")
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

#########
# This function processes incoming POST requests to update the chat history.
#########
@app.route('/api/update_chat_history', methods=['POST'])
def update_chat_history():
    data = request.get_json()
    thread_id, query = data.get('thread_id'), data.get('query')

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
        append_user_query(chat_history, thread_id, query, bool(semantic_fields_identified), bool(raw_fields_identified))
        logging.info(f"💬 Current chat history: {len(chat_history)}")

        return jsonify({
                "success": True,
                "thread_id": thread_id,
                "chat_history": chat_history[thread_id]
        })
    except Exception as e:
        logging.error(f"Update chat history failed for thread: {thread_id}, Error: {e}")
        return jsonify({"error": "Update chat history failed due to an internal error"}), 500

#########
# This function does returns 10 most popular datasets when component first mounts.
#########
@app.route('/api/most_popular_datasets', methods=['GET'])
def get_most_popular_datasets():
    logging.info(f"fetching most popular datasets")
    popular_results = most_popular_datasets()
    return jsonify(popular_results)


#########
# This function does first initial hyse_search based on first query.
#########
@app.route('/api/hyse_search', methods=['POST'])
def initial_search():
    initial_query = request.json.get('query')

    logging.info(f"✅THIS IS QUERY: {initial_query}")

    if not initial_query or len(initial_query.strip()) == 0:
        logging.error("Empty query provided")
        return jsonify({"error": "No query provided"}), 400

    try:
        logging.info("Starting hyse")
        initial_results, _, _ = hyse_search(initial_query, search_space=None, num_schema=1, k=50)  # Keep top 50 results in initial search
        logging.info("finished hyse")
        # append_system_response(chat_history, thread_id, initial_results, refine_type="semantic")

        # Update the cached results
        # chat_history[thread_id + '_cached_results'] = [result["table_name"] for result in initial_results]

        response_data = {
            "top_results": initial_results[:10],
            "complete_results": initial_results[:50],
        }

        logging.info(f"✅Search successful for query: {initial_query}")
        # logging.info(f"💬 Current chat history: {chat_history}")

        return jsonify(response_data), 200
    except Exception as e:
        logging.error(f"Search failed for query: {initial_query}, Error: {e}")
        return jsonify({"error": "Search failed due to an internal error"}), 500

#########
# This function 
#########
@app.route('/api/refine_search_space', methods=['POST'])
def refine_search_space():
    thread_id = request.get_json().get('thread_id')

    # Validate thread_id and query presence
    if not thread_id or thread_id not in chat_history:
        return jsonify({"success": False, "error": "Invalid or missing thread_id"}), 400
    
    try:
        # Get the cached results
        cached_results = chat_history.get(thread_id + "_cached_results")
        # logging.info(f"📩Current cached results: {cached_results}")

        # Initialize defaults
        refined_results, inferred_semantic_fields, inferred_raw_fields = [], [], []

        # Get user current and previous queries
        cur_query, prev_query = get_user_queries(chat_history, thread_id)
        # Check if the current query mentions semantic / raw metadata fields
        mention_semantic_fields, mention_raw_fields = get_mentioned_fields(chat_history, thread_id)

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
            # Update the cached results to previous search results
            cached_results = get_last_results(chat_history, thread_id)
            chat_history[thread_id + "_cached_results"] = cached_results
            return jsonify({"success": True, "message": "Successfully reset to last results set"}), 200
        
        # Step 2.2: If REFINE
        # Step 3.1: Handle mentioned SEMANTIC metadata fields in user current query
        if mention_semantic_fields:
            # Identify mentioned semantic metadata fields
            inferred_semantic_fields = infer_mentioned_metadata_fields(cur_query=cur_query, semantic_metadata=True).get_true_fields()
            logging.info(f"✅Inferred mentioned semantic metadata fields for current query '{cur_query}': {inferred_semantic_fields}")

            # TODO: Filter semantic refined results based on cosine similarity scores for better precision?
            refined_results = handle_semantic_fields(chat_history, thread_id, search_space=cached_results)
            append_system_response(chat_history, thread_id, refined_results, refine_type="semantic")

        # Step 3.2: Handle mentioned RAW metadata fields in user current query
        if mention_raw_fields:
            # Identify mentioned raw metadata fields
            inferred_raw_fields = infer_mentioned_metadata_fields(cur_query=cur_query, semantic_metadata=False).get_true_fields()
            logging.info(f"✅Inferred mentioned raw metadata fields for current query '{cur_query}': {inferred_raw_fields}")
            
            sql_clauses, refined_results = handle_raw_fields(cur_query, inferred_raw_fields, search_space=cached_results)
            append_system_response(chat_history, thread_id, refined_results, refine_type="raw")

        # logging.info(f"💬Current chat history: {chat_history}")

        # Package the response with additional information from the second message onwards
        response_data = {
            "top_results": refined_results[:10],
            "complete_results": refined_results,
            "inferred_action": inferred_action.get_true_fields(),
            "mention_semantic_fields": inferred_semantic_fields,
            "mention_raw_fields": inferred_raw_fields,   
            "filter_prompts" : sql_clauses,         
        }

        return jsonify(response_data), 200
        
    except Exception as e:
        logging.error(f"Search refinement failed, Error: {e}")
        return jsonify({"error": "Search refinement failed due to an internal error"}), 500

@app.route('/api/refine_metadata', methods=['POST'])
def refine_metadata():
    cur_query = request.json.get('cur_query')
    filters = request.json.get('filters')    
    logging.info(f"✅✅filters: {filters}")

    mention_semantic_fields = True if cur_query else False
    mention_raw_fields = True if filters else False

    try:
        # Initialize defaults
        refined_results, inferred_semantic_fields, inferred_raw_fields = [], [], []
        
        # Step 2.2: If REFINE
        # Step 3.1: Handle mentioned SEMANTIC metadata fields in user current query
        if mention_semantic_fields:
            # Identify mentioned semantic metadata fields
            inferred_semantic_fields = infer_mentioned_metadata_fields(cur_query=cur_query, semantic_metadata=True).get_true_fields()
            logging.info(f"✅Inferred mentioned semantic metadata fields for current query '{cur_query}': {inferred_semantic_fields}")
            search_space = hyse_search(cur_query, search_space=None, num_schema=1, k=100)
            table_names = [d["table_name"] for d in search_space[0]]
            logging.info(f"✅Table names of '{cur_query}': {table_names}")


            # TODO: Filter semantic refined results based on cosine similarity scores for better precision?
            # refined_results = handle_semantic_fields(chat_history, thread_id, search_space=cached_results)
            # append_system_response(chat_history, thread_id, refined_results, refine_type="semantic")
        else:
            logging.info("ELSE NO TASK")
            search_space = jsonify(most_popular_datasets())
            table_names = [d["table_name"] for d in search_space[0]]
            logging.info(f"✅Table names of '{cur_query}': {table_names}")


        # Step 3.2: Handle mentioned RAW metadata fields in user current query
        if filters is not None:
            # Identify mentioned raw metadata fields
            # inferred_raw_fields = infer_mentioned_metadata_fields(cur_query=filters, semantic_metadata=False).get_true_fields()
            # logging.info(f"✅Inferred mentioned raw metadata fields for current query '{cur_query}': {inferred_raw_fields}")
            # logging.info(table_names)
            sql_clauses, refined_results = handle_raw_filters(cur_query, filters, search_space=table_names)
            # append_system_response(chat_history, thread_id, refined_results, refine_type="raw")
        else:
            sql_clauses = []
            refined_results=search_space
        # logging.info(f"💬Current chat history: {chat_history}")

        # Package the response with additional information from the second message onwards
        response_data = {
            "top_results": refined_results[:10],
            "complete_results": refined_results,
            "inferred_action": "refine",
            "mention_semantic_fields": inferred_semantic_fields,
            "mention_raw_fields": inferred_raw_fields,   
            "filter_prompts" : sql_clauses,         
        }

        return jsonify(response_data), 200
        
    except Exception as e:
        logging.error(f"Search refinement failed, Error: {e}")
        return jsonify({"error": "Search refinement failed due to an internal error"}), 500


# Route to suggest relevant columns based on a task and provided results
@app.route('/api/suggest_relevant_cols', methods=['POST'])
def suggest_relevant_cols():
    task_description = request.json.get('task')  
    results_data = request.json.get('results')  
    results_df = pd.DataFrame(results_data)  # Convert results to a DataFrame for easier processing

    # Initialize lists to store embeddings, column names, and dataset names
    column_embeddings = []  
    column_names = []  
    dataset_names = []  

    # Iterate through each row in the results DataFrame and extract the example schema
    for _, row in results_df.iterrows():
        column_embedding_dict = ast.literal_eval(row['example_cols_embed'])
        dataset_name = row['table_name'] 
        for column_name, embedding in column_embedding_dict.items():
            column_names.append(column_name)  
            column_embeddings.append(embedding) 
            dataset_names.append(dataset_name) 

    # Log the number of columns processed
    logging.info(f"Processed {len(column_names)} columns.")

    # Convert the list of embeddings into a NumPy array (one embedding per row)
    embedding_matrix = np.array(column_embeddings)
    logging.info(f"Embedding matrix shape: {embedding_matrix.shape}")

    # Perform K-Means clustering on the embeddings
    num_clusters = 15  # Number of clusters to create (can be adjusted based on data)
    kmeans = KMeans(n_clusters=num_clusters, random_state=42)
    kmeans.fit(embedding_matrix)

    # Initialize dictionaries to store columns and datasets by cluster
    columns_by_cluster = {}  
    datasets_by_cluster = {}  

    # Assign columns and datasets to their respective clusters
    for idx, column_name in enumerate(column_names):
        cluster_id = kmeans.labels_[idx]  
        dataset_name = dataset_names[idx] 

        # Initialize lists for the cluster if they don't exist
        if cluster_id not in columns_by_cluster:
            columns_by_cluster[cluster_id] = []
            datasets_by_cluster[cluster_id] = []

        columns_by_cluster[cluster_id].append(column_name)
        datasets_by_cluster[cluster_id].append(dataset_name)

    # Log the columns and datasets in each cluster
    for cluster_id, columns in sorted(columns_by_cluster.items()):
        logging.info(f"Cluster {cluster_id} columns: {columns}")
        logging.info(f"Cluster {cluster_id} datasets: {datasets_by_cluster[cluster_id]}")

    # Calculate the average embedding for each cluster
    average_embeddings_by_cluster = {}
    for idx, cluster_id in enumerate(kmeans.labels_):
        if cluster_id not in average_embeddings_by_cluster:
            average_embeddings_by_cluster[cluster_id] = []
        average_embeddings_by_cluster[cluster_id].append(embedding_matrix[idx])

    # Compute the mean embedding for each cluster
    mean_embeddings_by_cluster = {}
    for cluster_id, embeddings in average_embeddings_by_cluster.items():
        mean_embeddings_by_cluster[cluster_id] = np.mean(np.array(embeddings), axis=0)

    # Calculate the similarity between the task embedding and each cluster's mean embedding
    task_embedding = openai_client.generate_embeddings(task_description)  # Generate embedding for the task
    similarity_by_cluster = {}

    for cluster_id, mean_embedding in mean_embeddings_by_cluster.items():
        mean_embedding = np.array(mean_embedding).reshape(1, -1) 
        task_embedding = np.array(task_embedding).reshape(1, -1) 
        similarity = cosine_similarity(mean_embedding, task_embedding)[0][0]  # 
        similarity_by_cluster[cluster_id] = similarity

    # Sort clusters by similarity in descending order
    sorted_clusters_by_similarity = sorted(
        similarity_by_cluster.items(), key=lambda x: x[1], reverse=True
    )
    
    # Format the top clusters for the response
    top_clusters = [
        {"cluster": int(cluster_id), "similarity": float(similarity)}
        for cluster_id, similarity in sorted_clusters_by_similarity
    ]

    # Extract column and dataset information for the top clusters
    top_columns_by_cluster = {
        int(item["cluster"]): columns_by_cluster[int(item["cluster"])]
        for item in top_clusters
    }

    top_datasets_by_cluster = {
    int(item["cluster"]): list(set(datasets_by_cluster[int(item["cluster"])]))
    for item in top_clusters
    }

    # Log the top clusters and their details
    logging.info(f"Top clusters by similarity: {type(top_clusters)}")
    logging.info(f"Columns in top clusters: {type(top_columns_by_cluster)}")
    logging.info(f"Datasets in top clusters: {type(top_datasets_by_cluster)}")

    # Consolidate the results (assuming a function `consolidate` exists)
    consolidated_results = list(consolidate(top_columns_by_cluster.values()))
    logging.info(f"Datasets in top clusters: {type(consolidated_results)}")


    response_data = {
    "top_clusters": list(top_clusters),
    "columns_in_clusters": [list(cols) for cols in top_columns_by_cluster.values()],
    "datasets_in_clusters": [list(set(datasets)) for datasets in top_datasets_by_cluster.values()],
    "consolidated_results": consolidated_results
}
    # Return the results as a JSON response
    return jsonify(response_data)

def consolidate(clusters):
        logging.info("CONSOLIDATION")
        logging.info(clusters)
        clusters_serializable = [list(cluster) for cluster in clusters]
        logging.info(f"Consolidate clusters: {type(clusters_serializable)}")

        messages = [ 
        {"role": "system", 
         "content": f"""You are an assistant that returns a flat list of unique English words. The input will be a list with nested elements. For each nested element, extract one or two representative words that describe it. The words should be lower case single words without special characters (like hyphens or underscores). The output must be a valid JSON array with no extra formatting or symbols, and there should be no repeats."""

        },
        {"role": "user", "content": json.dumps(clusters_serializable)}
        ]
    
        result = openai_client.infer_metadata_wo_instructor(messages)
        logging.info(f"RESULT: {type(result)}")
        if isinstance(result, str):  # Checking if result is a string
            try:
                # Try parsing as JSON first
                try:
                    result = json.loads(result)
                except json.JSONDecodeError:
                    # If JSON decoding fails, fall back to safely evaluating with ast.literal_eval
                    try:
                        result = ast.literal_eval(result)
                    except (ValueError, SyntaxError) as e:
                        # Handle possible exceptions during evaluation
                        logging.error(f"Error evaluating string: {e}")
                        # Treat the result as plain text
                        result = {"text": result}
            except Exception as e:
                logging.error(f"Error processing result: {e}")
                return jsonify({"error": "Unexpected error during result processing"}), 500
                
        logging.info(f"RESULT: {type(result)}")
        logging.info(result)
 
        return result

@app.route('/api/relevance_map', methods=['POST'])
def relevance_map():
    results = request.json.get('results')
    task = request.json.get('task')
    filters = request.json.get('filters')
    index = request.json.get('index')
    logging.info(task)
    logging.info(filters)
    filter_content = []
    for filter in filters:
        if filter["visible"] and filter['active']:
            filter_content.append(filter['filter'])
    logging.info(filter_content)

    results_df = pd.DataFrame(results)
    relevance_results = []
    schema = results_df.loc[index, 'example_rows_md']
    description = results_df.loc[index, 'dataset_context']
    source = results_df.loc[index, 'dataset_collection_method']
    purpose = results_df.loc[index, 'dataset_purpose']

    messages = [
        {
            "role": "system",
            "content": f"""
            You are an assistant that provides a dictionary with two keys: `isRelevant` and `notRelevant`. 

            ### **Dataset Details:**
            - **Description**: {description}  
            - **Example Rows**: {schema}  
            - **Purpose of dataset use**: {purpose}  
            - **Collection Method**: {source} 

            ### **Instructions:**  
            1. **"isRelevant"** ✅ Identify the **strongest** factors that make this dataset useful. Consider:
            - **Relevant attributes**
            - **Data quality**
            - **Matching features**
            - 🔹 If there are **no strong advantages**, return `"No significant utilities"`.

            2. **"notRelevant"** ❌ Identify **limitations** such as:
            - **Missing attributes**
            - **Specific geographical location**
            - **Time period**
            - **Incomplete data**
            - 🔹 If no major issues exist, return `"No significant limitations"`.
            
            ### **Guidelines:**  
            - **Stay factual**: Base responses strictly on the provided dataset details. Do not assume information that isn’t explicitly stated.  
            - **Be concise**: Limit each response to 1-2 sentences.  
            - **Avoid hallucination**: If no strong reason exists for relevance or irrelevance, default to `"No significant utilities"` or `"No significant limitations"`.  
            
            ### **Expected Output Format:**  
            Return your response as a dictionary with two keys: **"isRelevant"** and **"notRelevant"**, 
            where each value is a short, clear reason."""
        },
        {
            "role": "user",
            "content": f"Evaluate the dataset for my task: {task}, using these filters: {filter_content}."
        }
    ]

    result = openai_client.infer_metadata_wo_instructor(messages)
    if isinstance(result, str):
        try:
            result = ast.literal_eval(result)
        except (ValueError, SyntaxError) as e:
            print("Error evaluating the result string:", e)
    relevance_results.append(result)
    logging.info(relevance_results)

    return jsonify({
        "results": relevance_results,
    })

@app.route('/api/and_dataset_filter', methods=['POST'])
def and_dataset_filter():
    unique_datasets = request.json.get('uniqueDatasets')
    task = request.json.get('task')
    results = request.json.get('results')
    
    # Filter the DataFrame to include only rows where 'table_name' is in unique_datasets
    results_df = pd.DataFrame(results)
    filtered_results_df = results_df[results_df["table_name"].isin(unique_datasets)]


    return jsonify({
        "filtered_results": filtered_results_df.to_dict(orient="records"),
    })

@app.route('/api/reset_search_space', methods=['POST'])
def reset_search_space():
    thread_id = request.get_json().get('thread_id')
    results = request.json.get('results')

    # Validate thread_id and results presence
    if not thread_id or thread_id not in chat_history:
        return jsonify({"success": False, "error": "Invalid or missing thread_id"}), 400

    if not results:
        return jsonify({"success": False, "error": "No results provided"}), 400

    try:
        # Update the cached results
        chat_history[thread_id + "_cached_results"] = [result["table_name"] for result in results]
        # logging.info(f"💬Current chat history: {chat_history}")
        return jsonify({"success": True}), 200
    except Exception as e:
        logging.error(f"Search space reset failed for thread_id '{thread_id}', Error: {e}")
        return jsonify({"error": "Search space reset failed due to an internal error"}), 500

#########
# This function takes in a metadata filter and returns the metadata attribute selected.
#########
@app.route('/api/add_metadata', methods=['POST'])
def add_metadata():
    query = request.get_json().get('attribute')
    logging.info(query)

    messages = [ 
        {"role": "system", "content": f"""You are an assistant that will return a 'list' containing metadata attribute from {table_schema_dict} or an empty list. Given the user input, determine which key from the dictionary best describes the attribute as users might have spelling errors or use synonyms. 

        For example, if a key is col_num, a valid query might be "number of cols > 10" or "col_num > 10" which both indicate they want to execute a query with the number of cols. Another example, if a key is popularity, a valid query might be "pop > 5000".
            
        If any query uses an attribute that is not found in the dictionary, return an empty list. If a match is found, return [attribute, fixed query to match the dictionary]. For example, if the query was "number of cols > 10", the output should be a list ['num_col', 'num_col > 10'].             
        """
        },
        {"role": "user", "content": query}
        ]
    
    result = openai_client.infer_metadata_wo_instructor(messages)
    # Check if result is a string
    if isinstance(result, str):  # Checking if result is a string
        try:
            # Safely evaluate the string to convert to a list or other Python literal
            result = ast.literal_eval(result)
        except (ValueError, SyntaxError) as e:
            # Handle possible exceptions during evaluation
            logging.error(f"Error evaluating string: {e}")
            return jsonify({"error": "Invalid string format"}), 400

    return jsonify({"metadata": result})
    

#########
# This function takes in active filters and returns a dict of remaining attributes and their type that can be queryable.
#########
@app.route('/api/remaining_attributes', methods=['POST'])
def remaining_attributes():
    attribute = request.get_json().get('attributes')
    logging.info(attribute)
    result = {key: table_schema_dict[key] for key in table_schema_dict if key not in attribute}

    # Converting data into the desired format
    filters = []

    for key in table_schema_dict_frontend.keys():
        # Get the filter data for the current key
        operations = metadata_filtering_operations.get(key, [])
        values = metadata_values.get(key, [])
        
        # Create the filter object for the current key
        filter_obj = {
            "name": key,  # Keeping the key as the name
            "operations": operations,
            "values": values
        }
        
        filters.append(filter_obj)

    # Convert schema dictionary to DataFrame
    df = pd.DataFrame(table_schema_dict_frontend.items(), columns=["Metadata Attribute", "Data Type"])

    # Add descriptions to the DataFrame
    df["Description"] = df["Metadata Attribute"].map(metadata_descriptions)

    # Convert the DataFrame to CSV format
    csv_data = df.to_csv(index=False, sep="|")

    return jsonify({"attributes": result, "filters": filters, "csv_data": csv_data})
    

#########
# This function takes in a prompt and prunes it of unnecessary words, keeping only relevant content.
#########
@app.route('/api/prune_prompt', methods=['POST'])
def prune_prompt():
    query = request.get_json().get('query')
    if query and len(query) >= 1: 
        prompt = prune_query(query)
        logging.info(f"✅Prune successful for query: {query}")
        return jsonify({"pruned_query": prompt})


@app.route('/api/remove_metadata_update', methods=['POST'])
def remove_metadata_update():
    data = request.get_json()
    filters = data.get("filters")
    results = data.get("results")
    unique_datasets = data.get("uniqueDatasets")

    logging.info(filters)

    final_results = results  # Start with all results
    for filter in filters:
        selected_filter = filter["subject"]
        search_value = filter["value"]
        selected_operand = filter["operand"]

        if selected_filter == "column_specification":
            final_results = hnsw_search(search_value, final_results)

        elif selected_filter in ["table_name", "database_name", "db_description", "tags", "keywords", "metadata_queries", "time_granu", "geo_granu"]:
            clean_search_input = clean_input_value(search_value)
            logging.info(clean_search_input)

            temp_results = []
            for row in final_results:
                matches_all_inputs = True  

                for input_value in clean_search_input:
                    value = row.get(selected_filter)
                    if isinstance(value, list):  
                        if not any(fuzzy_match(input_value, str(item), 70) for item in value):
                            matches_all_inputs = False
                            break  
                    elif isinstance(value, str):  
                        words_in_value = value.split()
                        if not any(fuzzy_match(input_value, word, 70) for word in words_in_value):
                            matches_all_inputs = False
                            break  

                if matches_all_inputs:
                    temp_results.append(row)

            final_results = temp_results  # Update after filtering

        elif selected_filter in ["popularity", "col_num", "row_num", "usability_rating", "file_size_in_byte"]:
            df = pd.DataFrame(final_results)
            if selected_filter == "usability_rating":
                search_value = str(int(search_value) / 100)
            elif selected_filter == "file_size_in_byte":
                search_value = str(int(search_value) * 1024 * 1024)

            query = f"{selected_filter} {selected_operand} {search_value}"
            logging.info(query)
            filtered_results = df.query(query).copy()
            logging.info(len(filtered_results))
            final_results = filtered_results.to_dict(orient="records")

    results_df = pd.DataFrame(final_results)
    filtered_results_df = results_df[results_df["table_name"].isin(unique_datasets)].copy()

    return jsonify({"filtered_results": filtered_results_df.to_dict(orient="records")})


           

#########
# This function takes in a prompt and prunes it of unnecessary words, keeping only relevant content.
#########
@app.route('/api/manual_metadata', methods=['POST'])
def manual_metadata():
    selected_filter = request.get_json().get('selectedFilter')
    selected_operation = request.get_json().get('selectedOperation')
    search_input = request.get_json().get('value')
    results = request.get_json().get('results')
    logging.info(selected_filter)

    # HNSW search
    if selected_filter == 'column_specification':
        logging.info("COLUMN")
        final_results = hnsw_search(search_input, results)    

    # Fuzzy search based on search input
    elif selected_filter in ["table_name", "database_name", "db_description", "tags", "keywords", "metadata_queries", "time_granu", "geo_granu"]:
        clean_search_input = clean_input_value(search_input)
        logging.info(clean_search_input)
        final_results = []

        # Iterate over each row in the results
        for row in results:
            # For each row, check if all inputs in clean_search_input match
            matches_all_inputs = True  # Start assuming the row will match all inputs
            
            for input in clean_search_input:
                value = row.get(selected_filter)
                if isinstance(value, list):  # Handle lists (e.g., tags, keywords)
                    # Check if any item in the list matches the current search input
                    if not any(fuzzy_match(input, str(item), 70) for item in value):
                        matches_all_inputs = False
                        break  # No need to check further if one input doesn't match

                elif isinstance(value, str):  # Handle single string fields
                    words_in_value = value.split()  # Split the string into individual words
                    # Check if any word in the value matches the current search input
                    if not any(fuzzy_match(input, word, 70) for word in words_in_value):
                        matches_all_inputs = False
                        break  # No need to check further if one input doesn't match

            # If the row matches all inputs, add it to the final results
            if matches_all_inputs:
                final_results.append(row)
    
    elif selected_filter in ["popularity", "col_num", "row_num", "usability_rating", "file_size_in_byte"]:
        df = pd.DataFrame(results)
        if selected_filter == "usability_rating":
            search_input = str(int(search_input) / 100)
        elif selected_filter == "file_size_in_byte":
            search_input = str(int(search_input) * 1024 * 1024)
        query = selected_filter + selected_operation + search_input
        logging.info(query)

        filtered_results = df.query(query)
        logging.info(len(filtered_results))
        final_results = filtered_results.to_dict(orient="records")

    
       

    return jsonify({"results": final_results})


def fuzzy_match(query, value, threshold=80):
    """Returns True if the fuzzy match score is above the threshold."""
    return fuzz.partial_ratio(query.lower(), value.lower()) >= threshold

def clean_input_value(search_input):
    messages = [ 
        {"role": "system", 
        "content": f"""You are an assistant that processes user input and returns a list of strings. The user may provide search parameters in different formats. Here's how to handle each format:
        
        1. If the input is a single string (e.g., "x" or x), return a list with that string: [x].
        2. If the input is multiple items separated by "and" (e.g., "x and y and z"), return a list with those items: [x, y, z].
        3. If the input uses commas and "or" (e.g., "x, y, z or a, b, c"), return a combined list of all items from both parts: [x, y, z, a, b, c].
        4. If the input uses "and" and commas together (e.g., "x, y and z"), split the input into individual items: [x, y, z].
    
        Your task is to parse the input and return the correct list of strings based on the format above.
        """},
        {"role": "user", "content": search_input}

    ]


    result = openai_client.infer_metadata_wo_instructor(messages)
    logging.info(result)
    if isinstance(result, str):  # Checking if result is a string
        try:
            # Safely evaluate the string to convert to a list or other Python literal
            result = ast.literal_eval(result)
        except (ValueError, SyntaxError) as e:
            # Handle possible exceptions during evaluation
            logging.error(f"Error evaluating string: {e}")
            return jsonify({"error": "Invalid string format"}), 400
    return result

#########
# This function takes in a user message and determines which agent response to return.
#########
@app.route('/api/process_message', methods=['POST'])
def process_message():
    message = request.get_json().get('message')
    filters = request.get_json().get('filters')
    task_query = request.get_json().get('task')

    inferred_action = infer_action(cur_query=message, prev_query=task_query)
    logging.info(f"✅Inferred action for current query '{message}' and previous query '{task_query}': {inferred_action.model_dump()}")
    
    # TODO: Make sure for user's initial query, mention_semantic_fields is always True
    semantic_fields_identified = infer_mentioned_metadata_fields(cur_query=message, semantic_metadata=True).get_true_fields()
    raw_fields_identified = infer_mentioned_metadata_fields(cur_query=message, semantic_metadata=False).get_true_fields()
    logging.info(semantic_fields_identified)
    logging.info(raw_fields_identified)
    
    logging.info(task_query)
    #first search
    messages = [ 
    {"role": "system", 
    "content": f""" You are a helpful assistant that determines if the user message is a search query or a question. If the user message: {message} contains a desire to find a dataset of a certain topic, return True. Otherwise return False if it is a question or clarification.
    Only return a boolen.
    """
    },
    {"role": "user", "content": message}
    ]
    
    first_search = openai_client.infer_metadata_wo_instructor(messages)
    if first_search=="True" and not task_query:
        logging.info("first_search true and empty task")
        return jsonify({"reset": False, "refine": False, "system": False, "result": first_search})
    
    if first_search == "True":
        # If inferred action = RESET, reset search space & update task
        #TODO: should i reset the filters too?
        if inferred_action.reset and task_query:
            logging.info("RESET")
            messages = [ 
                {"role": "system", 
                "content": f""" You are a helpful assistant that refines search queries to make them specific. Users are currently exploring datasets and may not have a clear objective for the dataset in mind, so they require assistance in refining their intent. To be 'specific,' a query should include a topic and a clear task. Use the requirements to modify the query: {message}. Otherwise, return the message itself if it is a good search query.

                Output the refined query as a string only.
                """
                },
                {"role": "user", "content": message}
                ]
            
            result = openai_client.infer_metadata_wo_instructor(messages)
            return jsonify({"reset": True, "refine": False, "system": False, "result": result})


        # If REFINE, update task and do new search
        # TODO: suggestion metadata filters based on search
        elif inferred_action.refine:
            logging.info("REFINE")

            messages = [ 
                {"role": "system", 
                "content": f""" You are a helpful assistant that refines search queries: {message} to make them specific. Users are currently exploring datasets and may not have a clear objective for the dataset in mind, so they require assistance in refining their intent. To be 'specific,' a query should include a topic and a clear task. 

                For example, 'Presidential elections' is too broad. Instead, an example of a query that is specific enough would be, 'Train a predictive model on voter turnout in presidential elections.' This query has a clear topic (presidential elections) and a defined task (training a predictive model on voter turnout).

                Use the requirements to modify the query: {message} given the previous task_query: {task_query}. If task_query is empty, this means this is the first search. You can the message itself if it is a good search query.

                Output the refined query as a string only.
                """
                },
                {"role": "user", "content": message}
                ]
            
            result = openai_client.infer_metadata_wo_instructor(messages)
            return jsonify({"reset": False, "refine": True, "system": False, "result": result})


    # Otherwise system Q&A for clarification/question answering
    else:
        logging.info("Q&A")

        messages = [ 
            {"role": "system", 
            "content": f""" You are a helpful assistant that helps with clarification and answer questions concisely the user may have about their search queries. You have access to the user's previous seach query: {task_query} and the filters they are using: {filters}.
            """
            },
            {"role": "user", "content": message}
            ]
        
        result = openai_client.infer_metadata_wo_instructor(messages)
        logging.info(result)
        return jsonify({"reset": False, "refine": False, "system": True,"result": result})





#########
# This section is for autogen conversation in chatbot area.
#########  
class MyConversableAgent(ConversableAgent):
    async def a_get_human_input(self, prompt: str) -> str:
        logging.info("async human input")

        start_time = time.time()
        global chat_status
        chat_status="inputting"
        while True:
            if not user_queue.empty():
                logging.info("checking user_queue")
                input_value = user_queue.get()
                chat_status = "chat ongoing"
                return input_value
            if time.time() - start_time > 600: #10 min timeout mechanism for memory leaks
                chat_status = "ended"
                return "exit"
            await asyncio.sleep(1)

async def print_messages(recipient, messages, sender, config):
    print(f"Messages from: {sender.name} sent to {recipient.name} | num messages: {len(messages)} | message: {messages[-1]}")
    content = messages[-1]['content']
    print(messages[-1])

    if all(key in messages[-1] for key in ['name']):
        print_queue.put({'user': messages[-1]['name'], 'message': content}) #ensures 'name' key exists
    elif messages[-1]['role'] == 'user':
        print_queue.put({'user': sender.name, 'message': content})
    else:
        print_queue.put({'user': recipient.name, 'message': content})
    
    return False, None #conversation continued

def create_userproxy():
    user_proxy = MyConversableAgent(
        name = "user_proxy",
        system_message="A human admin.",
        human_input_mode="ALWAYS",
        llm_config=llm_config
        )
    user_proxy.register_reply(
        [autogen.Agent, None],
        reply_func=print_messages,
        config={"callback":None}
    )
    return user_proxy

async def initiate_chat(agent, recipient, message, max_turns):
    logging.info("initiating chat between recipient and user")
    result = await agent.a_initiate_chat(recipient, message=message, summary_method="reflection_with_llm", max_turns=max_turns, clear_history = False)
    return result

def run_chat(thread_id, user_query, task, filters):
    global chat_status
    logging.info("run_chat running.")
    try: 
        with app.app_context():
            #data structure for the req
            user = create_userproxy()
            global task_query
            logging.info("TAKS QUERY: " + task_query)
            # initial_results = hyse_search(user_query, search_space=None)

            # query_refiner = AssistantAgent(name="query_refiner", 
            # system_message="""
            # You are a helpful assistant that refines search queries to make them specific. Users are currently exploring datasets and may not have a clear objective for the dataset in mind, so they require assistance in refining their intent. Ask a single, directed question to help the user clarify their search in one step, aiming to make the query specific enough to elicit their search intent. To be 'specific,' a query should include a topic and a clear task.

            # For example, 'I want a dataset on presidential elections' is too broad. In this case, you should ask a question that helps clarify the task or narrow the scope in just one step.

            # An example of a query that is specific enough would be, 'I want a dataset to train a predictive model on voter turnout in presidential elections.' This query has a clear topic (presidential elections) and a defined task (training a predictive model on voter turnout).

            # After asking the question and receiving the user's response, provide an example of the refined query based on their input: 'An example of the refined query based on your input is: [refined query].' Additionally, offer 3 alternative queries by stating 'Alternative queries:' followed by concise examples to help guide them towards a more specific query. Otherwise, if the search query is specific enough (having both a topic and a clear task), inform the user that they can now proceed to query metadata attributes.
            # """,
            # llm_config=llm_config
            # )
            metadata_agent = AssistantAgent(name="metadata_agent", 
            system_message=f"""     
            You are a helpful assistant that will help reduce the search space given the user query: {task_query}. Given all the metadata attributes and their type: {table_schema_dict}, propose the top 3 metadata attributes from the provided list that will be useful to query over for the given user query. The metadata attributes should be about structure of the dataset, such as number of columns or time granularity, and not for task semantics, such as tags and description. 
            """,
            llm_config=llm_config
            )
            # Define Graph Agent
            #            You are a helpful AI assistant and have access to a Plotly to execute Python code and generate an interactive graph.
                # Refer to {table_schema_dict} to match the user input column to actual column name and determine whether it is a numerical or categorical type. For example, "INT" would be considered numerical and "TEXT" would be considered categorical. Determine one metadata atrribute from the schema that will be useful to query over for the user query: {task_query}. The metadata attributes should be about structure of the dataset, such as number of columns or time granularity, and not for task semantics, such as tags and description. You will suggest the correct column name for the `generate_histogram` function on based on the user input. 
            
            # metadata_agent = AssistantAgent(name="metadata_agent", 
            #     system_message=f"""
            #     You are a helpful agent that will suggest {numbers} as a parameter for the function `generate_histogram.`    
            #     """,
            #     llm_config=llm_config,
            # )


            # Register the function with the correct dataset
            # metadata_agent.register_for_llm(name="generate_histogram", description="Generate a histogram graph for data visualization.")(generate_histogram)
            # user.register_for_execution(name="generate_histogram")(lambda data: generate_histogram(data))

            # graph_agent.register_for_llm(name="generate_histogram", description="Returns histogram based on the numerical column specified.")(generate_histogram)
            # user.register_for_execution(name="generate_histogram")(lambda col_name: generate_histogram(col_name))
            
            # metadata_agent.register_reply(
            #     [UserProxyAgent, None],
            #     reply_func=print_messages,
            #     config={"callback": None}
            # )
            # query_refiner.register_reply(
            #     [UserProxyAgent, None],
            #     reply_func=print_messages,
            #     config={"callback": None}
            # )
            metadata_agent.register_reply(
                [UserProxyAgent, None],
                reply_func=print_messages,
                config={"callback": None}
            )
        
            # asyncio.run(initiate_chat(user, query_refiner, user_query, 4))
            # print("FINISHED RUNNNING INITIATE CHAT")
            metadata_message= f"Please use the new refined query from the summary to generate metadata attribute suggestions from {table_schema_dict} given the task query: {task_query}."
            asyncio.run(initiate_chat(user, metadata_agent, metadata_message, 4))
            # print("FINISHED RUNNNING METADATA CHAT")
            # graph_message = "Suggest the parameter needed to generate a histogram."
            # asyncio.run(initiate_chat(user, metadata_agent, graph_message, 4))
            # print("FINISHED RUNNNING GRAPH CHAT")
            chat_status="ended"
    
    except Exception as e:
        logging.error(f"runchat failed, Error: {e}")
        with app.app_context():
            return jsonify({"error": "Search failed due to an internal error"}), 500

def generate_histogram_spec(attribute, datasets):
    """Generate a Vega-Lite histogram specification."""
    # Extract data for the histogram
    logging.info(f"GENERATING HISTOGRAM for: {attribute}")
    data = [dataset[attribute] for dataset in datasets if attribute in dataset]
    logging.info(data)

    values = {}
    # Determine attribute type
    attribute_type = table_schema_dict[attribute]
    if "TEXT" in attribute_type:
    # Handle the case where the attribute type contains "TEXT"
        for entry in data:
            if isinstance(entry, list):  # If the entry is a list, iterate through sub-entries
                for sub_entry in entry:
                    if sub_entry in values:
                        values[sub_entry]["count"] += 1
                    else:
                        values[sub_entry] = {"attribute": sub_entry, "count": 1}
            else:  # If the entry is not a list, handle normally
                if entry in values:
                    values[entry]["count"] += 1
                else:
                    values[entry] = {"attribute": entry, "count": 1}

    elif "INT" in attribute_type or "DECIMAL" in attribute_type:
        # Handle the case where the attribute type contains "INT" or "DECIMAL"
        data_sorted = sorted(data)

        # Calculate Q1 (25th percentile) and Q3 (75th percentile)
        Q1 = np.percentile(data_sorted, 25)
        Q3 = np.percentile(data_sorted, 75)

        # Calculate the IQR (Interquartile Range)
        IQR = Q3 - Q1

        # Calculate the lower and upper bounds
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR

        # Find the outliers
        outliers = [x for x in data_sorted if x < lower_bound or x > upper_bound]

        # Filter the data to remove outliers
        filtered_data = [x for x in data if lower_bound <= x <= upper_bound]
        max_value = max(filtered_data)
        bins = np.round(np.linspace(0, max_value, num=9)).astype(int) # Create 8 bins
        hist, bin_edges = np.histogram(data, bins=bins)
        for i in range(len(hist)):
            entry = bin_edges[i]
            values[entry] = {"attribute": entry, "count": hist[i]}

    else:
        raise ValueError(f"Unexpected type for entry: {type(entry)}. Expected string or number.")
    
    # Output the result
    values = list(values.values())
    print(values)

    user_proxy = UserProxyAgent(
    name = "user_proxy",
    system_message="A human admin.",
    human_input_mode="ALWAYS",
    llm_config=llm_config
    )

    veta_agent = AssistantAgent(name="veta_agent", 
    system_message=f"""
    You are a helpful assistant that will generate a Vega-Lite histogram specification with hover tooltips. You have access to the Vega-Lite package and can make any necessary downloads needed. Use the values: {values} of the attribute {attribute} to generate a Vega-Lite visualization.

    - If the attribute is a numerical type, you should generate a histogram with bins that display the range of values, such as "attribute: 0-10", "attribute: 10-20", and so on. Allow for selection of the bars.

    - If the attribute is a categorical type, group each unique category together and graph the counts per category. Create a checklist on the side for all the unique categories.

    For values that are null, replace them with the string "None". Make sure to store each value in data.value as a dictionary. If there are multiple values separated by commas inside each item in data.value, separate the values and group them with all other same values across the data.value.
    Use "https://vega.github.io/schema/vega-lite/v5.json" for the $schema. Return only the Vega-Lite specification in the dictionary format.
    """,
    llm_config=llm_config
    )

    try:
        logging.info("initiating vega-lite agent chat")
        veta_message= "Generate an appropriate Vega-Lite histogram depending on the metadata attribute's type."
        chat_result = user_proxy.initiate_chat(veta_agent, message=veta_message, summary_method="reflection_with_llm", max_turns=1)
        print(chat_result)
        result = re.search(r"{(.*)}", chat_result.chat_history[1]["content"], re.DOTALL)
        print("VEGA", result)
        if result:
            extracted = "{" + result.group(1) + "}"
    
        return extracted
    
    except Exception as e:
        logging.error(f"Starting autogen refinement failed, Error: {e}")
        return jsonify({"error": "Search failed due to an internal error"}), 500  



@app.route('/api/suggest_and_generate', methods=['POST'])
def suggest_and_generate():
    """Endpoint to suggest an attribute and generate a histogram."""
    attribute = request.get_json().get('attribute')
    logging.info(attribute)
    # Step 1: Suggest attribute using LLM
    suggested_attribute = attribute
    ###################
    datasets = get_datasets() ######## will need to reset research based on current parameters #######

    # Step 2: Generate Vega-Lite spec for the suggested attribute
    try:
        vega_lite_spec = generate_histogram_spec(suggested_attribute, datasets)

    except KeyError:
        return jsonify({"error": f"Attribute '{suggested_attribute}' not found in datasets."}), 400

    return jsonify({"attribute": suggested_attribute, "vegaLiteSpec": vega_lite_spec, "outliers": ""})

@app.route('/api/vega_testing', methods=['POST'])
def vega_testing():
    """Endpoint to suggest an attribute and generate a histogram."""
    suggested_attribute = request.get_json().get('attribute')
    task = request.get_json().get('task')

    logging.info(suggested_attribute)
    attribute_type = table_schema_dict[suggested_attribute]
    # datasets = request.get_json().get('datasets')
    datasets, _, _= hyse_search(task, search_space=None, num_schema=1, k=100)

    # Remove outliers using the IQR method
    def remove_outliers(data):
        if not data:  # Ensure the list isn't empty
            return [], []
        data = np.array(data, dtype=float)
        Q1 = np.percentile(data, 25)  
        Q3 = np.percentile(data, 75)  
        IQR = Q3 - Q1  
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        # Keep only values within the bounds
        outliers = [x for x in data if x < lower_bound or x > upper_bound]
        data = [x for x in data if lower_bound <= x <= upper_bound]
        return data, outliers


    if "TEXT" in attribute_type:
        data = generate_histogram_spec(suggested_attribute, datasets)

    else:
        logging.info(f"GENERATING HISTOGRAM for: {suggested_attribute}")
        data = [dataset[suggested_attribute] for dataset in datasets if suggested_attribute in dataset]
        # Apply outlier removal
        data, outliers = remove_outliers(data)
        value = np.median(data)
        logging.info(data)
        logging.info("OUTLIERS", outliers)


    try:
        return jsonify({"attribute": suggested_attribute, "attribute_type": attribute_type, "vegaLiteSpec": data, "outliers": len(outliers), "value": value})
    
    except Exception as e:
        logging.error(f"Starting autogen refinement failed, Error: {e}")
        return jsonify({"error": "Search failed due to an internal error"}), 500 

@app.route('/api/suggest_metadata', methods=['POST'])
def suggest_metadata():
    logging.info("Starting metadata chat.")
    thread_id = request.get_json().get('thread_id')
    user_query = request.json.get('query')
    task = request.json.get('task')
    filters = request.json.get('filters')
    
    user_proxy = UserProxyAgent(
        name = "user_proxy",
        system_message="A human admin.",
        human_input_mode="ALWAYS",
        llm_config=llm_config
    )

    metadata_agent = AssistantAgent(name="metadata_agent", 
    system_message=f"""
        ## Instruction
        You are a helpful assistant that will help reduce the search space given the user query: {task}. The current filters used are {filters}. Given all the metadata attributes and their type: {table_schema_dict}, propose the top "2 NUMERICAL" metadata attributes from the provided list that will be useful to query over for the given user query. Do not repeat if the filter is already being used. The metadata attributes should be helpful in refining the user's task query and be about structure of the dataset, such as number of columns or time granularity, and not for task semantics, such as tags and description. You will also provide a reason less than 15 words which should be directly related to the task.
        
        ## Example
        For example, if the task was "I want a dataset for elections" then a possible metadata attribute that could be suggested would be 'col_num' with the reason: "can use col_num to identify more complex election datasets with multiple attributes, such as detailed candidate data, geographic breakdowns, or time-based trends, for deeper analysis."
        
        ## Output
        Return your suggestions in dictionary with only "key"=metadata attribute and 'value'=reason why we should use this attribute.
    """,
    llm_config=llm_config
    )
    try:
        logging.info("initiating metadata agent chat")
        chat_result = user_proxy.initiate_chat(metadata_agent, message=user_query, summary_method="reflection_with_llm", max_turns=1)
        result = re.search(r"{(.*)}", chat_result.chat_history[1]["content"], re.DOTALL)
        print(result)
        if result:
            extracted = "{" + result.group(1) + "}"

        
        return jsonify({"metadata_suggestions": extracted, "status": chat_status}), 200
    
    except Exception as e:
        logging.error(f"Starting autogen refinement failed, Error: {e}")
        return jsonify({"error": "Search failed due to an internal error"}), 500  

#########
# This function will return the most suitable agent to call next based on current state of query, task, and filters.
#########
@app.route('/api/start_autogen_chat', methods=['POST'])
def start_autogen_chat():
    logging.info("Starting autogen chat.")
    thread_id = request.get_json().get('thread_id')
    user_query = request.json.get('query')
    task = request.json.get('task')
    filters = request.json.get('filters')

    try:
        global chat_status
        global task_query
        if chat_status == 'error':
            chat_status = 'ended'
        with print_queue.mutex:
            print_queue.queue.clear()
        with user_queue.mutex:
            user_queue.queue.clear()
        
        chat_status = 'chat ongoing'
        logging.info("starting thread")
        
        # Start the thread and pass the request data
        thread = threading.Thread(target=run_chat, args=(thread_id, user_query, task, filters))
        thread.start()
        return jsonify({"status": chat_status}), 200
    
    except Exception as e:
        logging.error(f"Starting autogen chat failed, Error: {e}")
        return jsonify({"error": "Search failed due to an internal error"}), 500  
    

@app.route('/api/task_suggestions', methods=['POST'])
def task_suggestions():
    logging.info("Choosing autogen agent.")
    thread_id = request.get_json().get('thread_id')
    task = request.json.get('task')
    filters = request.json.get('filters')

    user_proxy = UserProxyAgent(
        name = "user_proxy",
        system_message="A human admin.",
        human_input_mode="ALWAYS",
        llm_config=llm_config
    )

    query_refiner = AssistantAgent(name="query_refiner", 
    system_message=f"""
        You are a helpful assistant that refines search queries to make them specific by returning a dictionary. Users are currently exploring datasets and may not have a clear objective for the dataset in mind, so they require assistance in refining their intent. To be 'specific,' a query should include a topic and a clear task. Use the requirements to generate the new queries: {task} and {filters}.

        For example, 'Presidential elections' is too broad. Instead, an example of a query that is specific enough would be, 'Train a predictive model on voter turnout in presidential elections.' This query has a clear topic (presidential elections) and a defined task (training a predictive model on voter turnout). 

        Additionally, generate 1 reason less than 10 words why the new query will be an improvement of the user query given. 

        Return 3 alternative queries as a 'dictionary' with unique keys being the improved query and the value as the reason. Make sure the final output is strictly a dictionary with this structure.
    """,
    llm_config=llm_config
    )

    try:
        logging.info("initiating autogen agent chat")
        chat_result = user_proxy.initiate_chat(query_refiner, message=task, summary_method="reflection_with_llm", max_turns=1)
        logging.info("finished chat_result")

        results = chat_result.chat_history[1]["content"]
        return jsonify({"query_suggestions": results, "status": chat_status}), 200
    
    except Exception as e:
        logging.error(f"Starting autogen refinement failed, Error: {e}")
        return jsonify({"error": "Search failed due to an internal error"}), 500  
    
#########
# This function is for the initial task suggestions based off settings generate.
#########
@app.route('/api/initial_task_suggestions', methods=['POST'])
def initial_task_suggestions():
    logging.info("INITAL_ TASK SUGGESTIONS")
    specificity = request.json.get('specificity')
    goal = request.json.get('goal')
    domain = request.json.get('domain')
    logging.info(specificity)
    logging.info(goal)
    logging.info(domain)
    messages = [ 
    {"role": "system", 
    "content": f"""   
        ### System Instructions ###
        You are a helpful assistant that constructs specific search queries. Users are exploring datasets and may not have a clear objective in mind, so they need assistance in refining their intent. A query should be considered "specific" when it includes both a topic and a clear task. An example of a specific query is: "Train a predictive model on voter turnout in presidential elections." This query clearly reflects the goal ("Train") and the topic (voter turnout in presidential elections). You will generate multiple queries related to the {domain} which provides the user's intent in free form text. 

        ### Task Instruction ###
        If the {goal} is "Not sure yet" or {specificity} is "I am exploring", it indicates the user is uncertain about where to start. Use DIFFERENT action verbs and variations of the {domain} to help them brainstrom what kind of task they want. 
        
        Otherwise, you MUST USE 'only the goal': {goal} when generating the queries. For example, if the goal was "Train a classifier", all queries should be related to that but vary slightly with different variations of the {domain}.

        ### Output ###
        Also, generate one reason 'less than 10 words' for why this new query will improve the user's original query. Return 3 queries as a dictionary with the query as the unique key and the value as the reason. Make sure the final output is strictly a dictionary with this structure.
    """
    },
    {"role": "user", "content": f"""Provide query suggestions for {domain}. Generate refinements using only the {goal}. If {goal} is "Not sure yet", then can explore different variations of the {domain}."""}
    ]

    result = openai_client.infer_metadata_wo_instructor(messages)
    logging.info("INTIAL TASK GENERATED")
    logging.info(result)
    return jsonify({"query_suggestions": result, "status": chat_status}), 200
    # user_proxy = UserProxyAgent(
    #     name = "user_proxy",
    #     system_message="A human admin.",
    #     human_input_mode="ALWAYS",
    #     llm_config=llm_config
    # )
    # query_refiner = AssistantAgent(name="query_refiner", 
    # system_message=f"""
    #     ### System Instructions ###
    #     You are a helpful assistant that constructs specific search queries. Users are exploring datasets and may not have a clear objective in mind, so they need assistance in refining their intent. A query should be considered "specific" when it includes both a topic and a clear task. An example of a specific query is: "Train a predictive model on voter turnout in presidential elections." This query clearly reflects the goal ("Train") and the topic (voter turnout in presidential elections). You will generate multiple queries using general topics related to the {domain}. 

    #     ### Task Instruction ###
    #     If the {goal} is "Not sure yet," it indicates the user is uncertain about where to start. Use DIFFERENT action verbs to help them brainstrom what kind of task they want. 
        
    #     Otherwise, you MUST USE 'only the goal': {goal} when generating the queries. For example, if the goal was "Analyze", all queries should start with "Analyze".

    #     ### Output ###
    #     Also, generate one reason 'less than 10 words' for why this new query will improve the user's original query. Return 3 queries as a dictionary with the query as the unique key and the value as the reason. Make sure the final output is strictly a dictionary with this structure.
        
    # """,
    # llm_config=llm_config
    # )

    # try:
    #     logging.info("initiating autogen agent chat")
    #     chat_result = user_proxy.initiate_chat(query_refiner, message=f"""Provide query suggestions for {domain}. Use only {goal} for the action verb. If {goal} is "Not sure yet", then use different action verbs. """, summary_method="reflection_with_llm", max_turns=1)
    #     logging.info("finished chat_result")
    #     results = chat_result.chat_history[1]["content"]
    #     return jsonify({"query_suggestions": results, "status": chat_status}), 200
    
    # except Exception as e:
    #     logging.error(f"Starting autogen refinement failed, Error: {e}")
    #     return jsonify({"error": "Search failed due to an internal error"}), 500  
 
      
#########
# This function takes front end message and puts it in queue for agents.
#########
@app.route('/api/send_message', methods=['POST'])
def send_message():
    logging.info("received user input from frontend")
    user_input = request.json.get('query')
    user_queue.put(user_input)
    return jsonify({'status': 'Message Received'})

#########
# This function displays messages from agents to frontend.
#########
@app.route('/api/get_message', methods=['GET'])
def get_messages():
    global chat_status
    if not print_queue.empty():
        msg = print_queue.get()
        logging.info(msg)
        return jsonify({'message': msg, 'status': chat_status}), 200 
    else:
        return jsonify({'message': '', 'status': chat_status}), 200
    
#########
# This function updates the task query.
#########
@app.route('/api/get_task', methods=['POST'])
def get_task():
    global task_query
    logging.info("received updated task from frontend")
    user_input = request.json.get('query')
    task_query = user_input
    logging.info(task_query)
    return jsonify({'status': 'Message Received'})

#########
# This function updates the metadata attriutes.
#########
@app.route('/api/get_metadata_filters', methods=['GET'])
def get_metadata_filters():
    global metadata_filters
    if not print_queue.empty():
        msg = print_queue.get()
        logging.info(msg)
        return jsonify({'message': msg, 'status': chat_status}), 200 
    else:
        return jsonify({'message': '', 'status': chat_status}), 200

if __name__ == '__main__':
    app.run(debug=True)

