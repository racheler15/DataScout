from backend.app.table_representation.openai_client import OpenAIClient
from backend.app.utils.utils import format_prompt, format_cos_sim_results
from backend.app.db.connect_db import DatabaseConnection
from pydantic import BaseModel
from typing import List, Any
import random
import logging
import numpy as np
from dotenv import load_dotenv

load_dotenv()

# Initialize OpenAI client
openai_client = OpenAIClient()

# Craft schema inference prompt
PROMPT_SINGLE_SCHEMA = """
Given the task of {query}, help me generate a database schema to to implement the task.
Only generate one table schema, excluding any introductory phrases and focusing exclusively on the tasks themselves.
Generate a JSON with keys as table names and values as column names, data types, and example rows. For example:

Task:
What data is needed to train a machine learning model to predict housing prices?

Output: 
{{
    "table_name": "Open Domain QA",
    "column_names": ["id", "question", "context", "answer", "source"],
    "data_types": ["INT", "TEXT", "TEXT", "TEXT", "TEXT"],
    "example_row": [1, "What is the capital of France?", "France is a country in Europe. Its capital is Paris.", "Paris", "Wikipedia"]
}}
"""

PROMPT_MULTI_SCHEMA = """
Given the task of {query}, generate a database schema of at least 1, and at most {num_left} normalized table headers that are needed to implement the task.
Generate a list in which each element is a JSON with keys as table names and values as column names, data types, and example rows. For example:

Task:
What data is needed to train a machine learning model to predict housing prices?

Output: 
[
  {{
    "table_name": "Open Domain QA",
    "column_names": ["id", "question", "context", "answer", "source"],
    "data_types": ["INT", "TEXT", "TEXT", "TEXT", "TEXT"],
    "example_row": [1, "What is the capital of France?", "France is a country in Europe. Its capital is Paris.", "Paris", "Wikipedia"]
  }},
  {{
    "table_name": "Multilingual Multichoice QA",
    "column_names": ["id", "language", "question", "option_a", "option_b", "option_c", "option_d", "correct_answer", "translation_en"],
    "data_types": ["INT", "TEXT", "TEXT", "TEXT", "TEXT", "TEXT", "TEXT", "CHAR(1)", "TEXT"],
    "example_row": [101, "es", "¿Cuál es la capital de Alemania?", "Berlín", "Madrid", "París", "Roma", "A", "What is the capital of Germany?"]
  }},
  ...
]
"""

# TODO: refactor pydantic models
# Define desired output structure
class TableSchema(BaseModel):
    table_name: str
    column_names: List[str]
    data_types: List[str]
    example_row: List[Any]

def hyse_search(initial_query, search_space=None, num_schema=3, k=10, table_name="eval_final_all", column_name="example_rows_embed"):
    # Step 0: Initialize the results list and num_left
    results = []
    num_left = num_schema

    # Step 1: Single HySE search
    # Step 1.1: Infer a single denormalized hypothetical schema
    single_hypo_schema_json = infer_single_hypothetical_schema(initial_query).json()

    # Step 1.2: Generate embedding for the single hypothetical schema
    single_hypo_schema_embedding = openai_client.generate_embeddings(text=single_hypo_schema_json)

    # Step 1.3: Cosine similarity search between e(hypo_schema_embed) and e(existing_scheme_embed)
    single_hyse_results = cos_sim_search(single_hypo_schema_embedding, search_space, table_name, column_name)
    results.append(single_hyse_results)

    # Step 1.4: Update num_left by decrementing it by 1
    num_left -= 1
    
    # Step 2: Multiple HySE search
    while num_left > 0:
        # Step 2.1: Randomly generate the number of normalized schemas m ranging from 1 to num_left
        m = random.randint(1, num_left)

        # Step 2.2: Infer multiple normalized hypothetical schemas
        multi_hypo_schemas, m = infer_multiple_hypothetical_schema(initial_query, m)
        multi_hypo_schemas_json = [schema.json() for schema in multi_hypo_schemas]
        logging.info(f"Multiple hypothetical schemas JSON: {multi_hypo_schemas_json}")

        # Step 2.3: Generate embeddings for the multiple hypothetical schemas
        multi_hypo_schemas_embeddings = [openai_client.generate_embeddings(text=schema_json) for schema_json in multi_hypo_schemas_json]

        # Step 2.4: Cosine similarity search for each multiple hypothetical schema embedding
        for hypo_schema_embedding in multi_hypo_schemas_embeddings:
            results.append(cos_sim_search(hypo_schema_embedding, search_space, table_name, column_name))
        
        # Step 2.5: Update num_left by decrementing it by m
        num_left -= m

    # Step 3: Aggregate results from single & multiple HySE searches
    aggregated_results = aggregate_hyse_search_results(results)

    # Sort aggregated results by cosine similarity and keep top k
    aggregated_results.sort(key=lambda x: x['cosine_similarity'], reverse=True)


    top_k_results = aggregated_results[:k]

    return top_k_results, single_hypo_schema_json, single_hypo_schema_embedding

def infer_single_hypothetical_schema(initial_query):
    prompt = format_prompt(PROMPT_SINGLE_SCHEMA, query=initial_query)

    response_model = TableSchema

    messages = [
        {"role": "system", "content": "You are an assistant skilled in generating database schemas."},
        {"role": "user", "content": prompt}
    ]

    return openai_client.infer_metadata(messages, response_model)

def infer_multiple_hypothetical_schema(initial_query, num_left):
    prompt = format_prompt(PROMPT_MULTI_SCHEMA, query=initial_query, num_left=num_left)

    response_model = List[TableSchema]

    messages = [
        {"role": "system", "content": "You are an assistant skilled in generating normalized database schemas."},
        {"role": "user", "content": prompt}
    ]

    response = openai_client.infer_metadata(messages, response_model)
    m = len(response)
    return response, m

def hnsw_search(column, search_space, table_name="eval_final_all_column_embeddings", column_name="embedding"):
    logging.info(column)
    given_column_embedding = openai_client.generate_embeddings(column) 
    table_names = [item['table_name'] for item in search_space]
    logging.info(search_space)
    with DatabaseConnection() as db:
        if table_names:
            # Filter by specific table names
            query = f"""
                SELECT *, 1 - ({column_name} <=> %s::VECTOR(1536)) AS cosine_similarity
                FROM {table_name}
                WHERE table_name = ANY(%s)
                ORDER BY cosine_similarity DESC
                LIMIT 50;
            """
            db.cursor.execute(query, (given_column_embedding, table_names))
        
        logging.info("FETCH ")
        results = db.cursor.fetchall()
        if results:
            table_names = []

            for idx, result in enumerate(results, start=1):
                # Extract cosine_similarity, table_name, and column_name
                cos_sim = result['cosine_similarity']
                table_name = result['table_name']

                # Print only results with cosine_similarity > 0.4 (40%)
                if cos_sim > 0.4:
                    logging.info(f"Rank {idx}: {cos_sim} - Table: {table_name}, Column: {result['column_name']}")

                    # Append table name if it has a cosine similarity greater than 40%
                    table_names.append(table_name)

        # Get unique table names where cosine similarity is greater than 40%
        unique_table_names = list(set(table_names))
        logging.info(f"Unique table names with cosine_similarity > 40%: {unique_table_names}")
        logging.info(len(unique_table_names))

        logging.info("Search Space: %s", search_space)
        filtered_datasets = [dataset for dataset in search_space if dataset['table_name'] in unique_table_names]
        logging.info(filtered_datasets)
        return filtered_datasets

def cos_sim_search(input_embedding, search_space, table_name="eval_final_all", column_name="example_rows_embed"):  
    # Ensure input_embedding is a list before passing to execute
    if isinstance(input_embedding, np.ndarray):
        input_embedding = input_embedding.tolist()
    elif isinstance(input_embedding, list):
        input_embedding = input_embedding
    else:
        input_embedding = list(input_embedding)
    
    with DatabaseConnection() as db:
        db.reset_connection()

        if search_space:
            # Filter by specific table names
            query = f"""
                SELECT *, 1 - ({column_name} <=> %s::VECTOR(1536)) AS cosine_similarity
                FROM {table_name}
                WHERE table_name = ANY(%s)
                ORDER BY cosine_similarity DESC;
            """
            db.cursor.execute(query, (input_embedding, search_space))
        else:
            # No specific search space, search through all table names
            logging.info("COLLECTING COUNT")
            print(f"Executing query: SELECT COUNT(*) FROM {table_name};")
            query = "SELECT COUNT(*) FROM eval_final_all;"
            db.cursor.execute(query)
            row_count = db.cursor.fetchone()['count']  # Fetch the count result as a dictionary
            print(f"Total rows in db: {row_count}")

            query = f"""
                SELECT *, 1 - ({column_name} <=> %s::VECTOR(1536)) AS cosine_similarity
                FROM {table_name}
                ORDER BY cosine_similarity DESC
                LIMIT 50;
            """
            db.cursor.execute(query, (input_embedding,))
        
        results = db.cursor.fetchall()
    
    # Ensure results are correctly structured
    formatted_results = [{'table_name': row['table_name'], 'cosine_similarity': float(row['cosine_similarity'])} for row in results]
    # logging.info(formatted_results)
    return results

def aggregate_hyse_search_results(results):
    # Flatten the list of results
    flat_results = [item for sublist in results for item in sublist]
    logging.info("AGGREGATE_HYSE")
    # Aggregate by table name and calculate mean cosine similarity
    aggregated_results = {}
    logging.info("TRYING RESULTS")
    for result in flat_results:
        db_name = result['database_name'].lower()
        logging.info(db_name)

        keywords = ["building data genome", "georgia voter lists", "ohio census data", "costa rica", "life expectancy", "who health indicators", "nasdaq", "coffee"]

        if any(keyword in db_name for keyword in keywords):            
            logging.info("SKIPPING")
            continue
        
        table_name = result['table_name']
        database_name = result['database_name']
        cosine_similarity = result['cosine_similarity']
        example_rows_md = result['example_rows_md']
        time_granu = result['time_granu']
        geo_granu = result['geo_granu']
        db_description = result['db_description']
        col_num = result['col_num']
        row_num = result['row_num']
        popularity = result['popularity']
        usability_rating = result['usability_rating']
        tags = result['tags']
        file_size_in_byte = result['file_size_in_byte']
        keywords = result['keywords']
        task_queries = result['task_queries']
        metadata_queries = result['metadata_queries']
        example_rows_embed = result['example_rows_embed']
        example_cols_embed = result['example_cols_embed']
        dataset_context = result['dataset_context']
        dataset_purpose = result['dataset_purpose']
        dataset_source = result['dataset_source']
        dataset_collection_method = result['dataset_collection_method']
        dataset_column_dictionary = result['dataset_column_dictionary']
        dataset_references = result['dataset_references']
        dataset_acknowledgements = result['dataset_acknowledgements']

        
        if not isinstance(cosine_similarity, (int, float)):
            logging.error(f"Unexpected type for cosine_similarity: {type(cosine_similarity)} with value {cosine_similarity}")
            raise ValueError(f"Unexpected type for cosine_similarity: {type(cosine_similarity)}")
        
          # Add cosine similarity and other data to aggregated results by table name
        if table_name not in aggregated_results:
            aggregated_results[table_name] = {
                'table_name': table_name,
                'database_name': database_name,
                'example_rows_md': example_rows_md,
                'time_granu': time_granu,
                'geo_granu': geo_granu,
                'db_description': db_description,
                'col_num': col_num,
                'row_num': row_num,
                'popularity': popularity,
                'usability_rating': usability_rating,
                'tags': tags,
                'file_size_in_byte': file_size_in_byte,
                'keywords': keywords,
                'task_queries': task_queries,
                'metadata_queries': metadata_queries,
                'example_rows_embed': example_rows_embed,
                'example_cols_embed': example_cols_embed,
                'dataset_context': dataset_context,
                'dataset_purpose': dataset_purpose,
                'dataset_source': dataset_source,
                'dataset_collection_method': dataset_collection_method,
                'dataset_column_dictionary': dataset_column_dictionary,
                'dataset_references': dataset_references,
                'dataset_acknowledgements': dataset_acknowledgements,
                'cosine_similarity': [cosine_similarity],
            }
        else:
            # Add cosine similarity to existing entry
            aggregated_results[table_name]['cosine_similarity'].append(cosine_similarity)
    
    # Calculate the mean cosine similarity for each table
    final_results = [
    {
        **aggregated_results[table_name],  # Include all the aggregated data
        'cosine_similarity': sum(aggregated_results[table_name]['cosine_similarity']) / len(aggregated_results[table_name]['cosine_similarity'])
    }
    for table_name in aggregated_results
    ]
    
    # Sort the final results by mean cosine similarity in descending order
    final_results.sort(key=lambda x: x['cosine_similarity'], reverse=True)

    return final_results
    

def most_popular_datasets():
    with DatabaseConnection() as db:        
        # No specific search space, search through all table names
        query = f"""
            SELECT *
            FROM eval_final_all
            ORDER BY usability_rating DESC
            LIMIT 10
        """
        db.cursor.execute(query)    
        results = db.cursor.fetchall()
    return results

def get_datasets():
    with DatabaseConnection() as db:        
        # No specific search space, search through all table names
        query = f"""
            SELECT *
            FROM eval_final_all
        """
        db.cursor.execute(query)    
        results = db.cursor.fetchall()
    return results