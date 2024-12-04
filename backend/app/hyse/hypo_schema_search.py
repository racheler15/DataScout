from backend.app.table_representation.openai_client import OpenAIClient
from backend.app.utils import format_prompt, format_cos_sim_results
from backend.app.db.connect_db import DatabaseConnection
from pydantic import BaseModel
from typing import List, Any
import random
import logging
import numpy as np

# Initialize OpenAI client
openai_client = OpenAIClient()

# Craft schema inference prompt
# TODO: generate multiple hypothetical schemas
PROMPT_SINGLE_SCHEMA = """
Given the task of {query}, help me generate a database schema to to implement the task.
Only generate one table schema, excluding any introductory phrases and focusing exclusively on the tasks themselves.
Generate a JSON with keys as table names and values as column names, data types, and example rows. For example:

Task:
What data is needed to train a machine learning model to forecast demand for medicines across suppliers?

Output: 
{{
    "table_name": "Sales",
    "column_names": ["sale_id", "medicine_id", "supplier_id", "quantity_sold", "sale_date", "price", "region"],
    "data_types": ["INT", "INT", "INT", "INT", "DATE", "DECIMAL", "VARCHAR"],
    "example_row": [1, 101, 201, 50, "2024-06-01", 19.99, "North America"]
}}
"""

# TODO: refactor pydantic models
# Define desired output structure
class TableSchema(BaseModel):
    table_name: str
    column_names: List[str]
    data_types: List[str]
    example_row: List[Any]


def hyse_search(initial_query, search_space=None):
    results = []

    # Step 1: Infer hypothetical schema - single HYSE search
    # Step 1.1: Infer a single denormalized hypothetical schema
    single_hypo_schema_json = infer_hypothetical_schema(initial_query).json()
    logging.info(f"Single hypothetical schema JSON: {single_hypo_schema_json}")

    # Step 1.2: Generate embedding for the hypothetical schema
    single_hypo_schema_embedding = openai_client.generate_embeddings(text=single_hypo_schema_json)

    # Step 1.3: Cosine similarity search between e(hypo_schema_embed) and e(existing_scheme_embed)
    single_hyse_results = cos_sim_search(single_hypo_schema_embedding, search_space)
    results.append(single_hyse_results)
    
    # Step 1.4: Cosine similarity search between e(query) and e(existing_prev_queries_embed)
    query_embedding = openai_client.generate_embeddings(text=initial_query)
    initial_results = cos_sim_search(query_embedding, search_space, column_name="query_embed")
    return initial_results


def infer_hypothetical_schema(initial_query):
    prompt = format_prompt(PROMPT_SINGLE_SCHEMA, query=initial_query)

    response_model = TableSchema

    messages = [
        {"role": "system", "content": "You are an assistant skilled in generating database schemas."},
        {"role": "user", "content": prompt}
    ]

    return openai_client.infer_metadata(messages, response_model)

def cos_sim_search(input_embedding, search_space, column_name="comb_embed"):
    if column_name not in ["comb_embed", "query_embed"]:
        raise ValueError("Invalid embedding column")
    
    with DatabaseConnection() as db:
        if search_space:
            # Filter by specific table names
            query = f"""
                SELECT *, 1 - ({column_name} <=> %s::VECTOR(1536)) AS cosine_similarity
                FROM corpus_raw_metadata_with_embedding
                WHERE table_name = ANY(%s)
                ORDER BY cosine_similarity DESC;
            """
            db.cursor.execute(query, (input_embedding, search_space))
        else:
            # No specific search space, search through all table names
            query = f"""
               SELECT *, 1 - ({column_name} <=> %s::VECTOR(1536)) AS cosine_similarity
                FROM corpus_raw_metadata_with_embedding
                ORDER BY cosine_similarity DESC;
            """
            
            db.cursor.execute(query, (input_embedding, ))
        
        results = db.cursor.fetchall()
    return results

def most_popular_datasets():
    with DatabaseConnection() as db:        
        # No specific search space, search through all table names
        query = f"""
            SELECT *
            FROM corpus_raw_metadata_with_embedding
            ORDER BY popularity DESC
            LIMIT 10;
        """
        db.cursor.execute(query)    
        results = db.cursor.fetchall()
    return results

def get_datasets():
    with DatabaseConnection() as db:        
        # No specific search space, search through all table names
        query = f"""
            SELECT *
            FROM corpus_raw_metadata_with_embedding
        """
        db.cursor.execute(query)    
        results = db.cursor.fetchall()
    return results

