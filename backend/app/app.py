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
    consolidated_results = list(consolidate(top_columns_by_cluster.values(), task_description))
    logging.info(f"Datasets in top clusters: {type(consolidated_results)}")


    response_data = {
    "top_clusters": list(top_clusters),
    "columns_in_clusters": [list(cols) for cols in top_columns_by_cluster.values()],
    "datasets_in_clusters": [list(set(datasets)) for datasets in top_datasets_by_cluster.values()],
    "consolidated_results": consolidated_results
}
    # Return the results as a JSON response
    return jsonify(response_data)

def consolidate(clusters, task):
        logging.info("CONSOLIDATION")
        logging.info(clusters)
        clusters_serializable = [list(cluster) for cluster in clusters]
        logging.info(f"Consolidate clusters: {type(clusters_serializable)}")

        messages = [ 
        {"role": "system", 
         "content": f"""You are an assistant that returns a flat list of unique English words. The input will be a list with nested elements. For each nested element, return ** 1 to 2 representative words** that best represents the topic of the nested group. The representative word should also make sense in context with the {task}, so use 2 words if it will be more clear what the topic means in relation to the task. The words should be lower case single words without special characters (like hyphens or underscores). The output must be a valid JSON array with no extra formatting or symbols, and there should be no repeats."""

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
            - **Specific geographical location, e.g. "dataset is only in x location"**
            - **Time period, e.g. "dataset is only between x and y range"**
            - **Incomplete data**
            - 🔹 If no major issues exist, return `"No significant limitations"`.
            
            ### **Guidelines:**  
            - **Stay factual**: Base responses strictly on the provided dataset details. Do not assume information that isn’t explicitly stated. Make sure to distinguish your sources from the example rows or description (includes description, purpose, and collection method). 
            - **Be concise**: Limit each response to 1-2 sentences.  
            - **Avoid hallucination**: If no strong reason exists for relevance or irrelevance, default to `"No significant utilities"` or `"No significant limitations"`.  
            
            ### **Expected Output Format:**  
            Return your response as a dictionary with two keys: **"isRelevant"** and **"notRelevant"**, 
            where each value is a short, clear reason."""
        },
        {
            "role": "user",
            "content": f"Evaluate the dataset for my task: {task}, using these filters: {filter_content}. Make sure to identify limitations that involve time and location. Distinguish if the information is from the description or the dataset preview. "
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
        If the {goal} is "Not sure yet" or {specificity} is "I am exploring", it indicates the user is uncertain about where to start. Use DIFFERENT action verbs and variations of the {domain} to help them brainstorm what kind of task they want. 
        
        Otherwise, you MUST USE 'only the goal': {goal} when generating the queries. For example, if the goal was "Train a classifier", all queries should be related to that but vary slightly with different variations of the {domain}.

        Variations are just different factors that might impact the domain. For example, if the domain was "mental health", variations could be things that impact mental health like work life balance, living costs, job opportunity loss, etc. 

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

