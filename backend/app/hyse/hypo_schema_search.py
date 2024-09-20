from backend.app.table_representation.openai_client import OpenAIClient
from backend.app.utils import format_prompt, format_cos_sim_results
from backend.app.db.connect_db import DatabaseConnection
from pydantic import BaseModel

# Initialize OpenAI client
openai_client = OpenAIClient()

# Craft schema inference prompt
# TODO: generate multiple hypothetical schemas
PROMPT = """
Given the objective of {query}, help me generate a hypothetical table schema to support this.
Only generate one table schema, excluding any introductory phrases and focusing exclusively on the tasks themselves.
"""

# TODO: refactor pydantic models
# Define desired output structure
class TableSchema(BaseModel):
    column_names: list[str]
    data_types: list[str]


def hyse_search(initial_query, search_space=None):
    # Step 1: Infer hypothetical schema
    hypo_schema_json = infer_hypothetical_schema(initial_query).json()

    # Step 2: Generate embedding for the hypothetical schema
    hypo_schema_embedding = openai_client.generate_embeddings(text=hypo_schema_json)

    # Step 3: Cosine similarity search between e(hypo_schema_embed) and e(existing_scheme_embed)
    initial_results = cos_sim_search(hypo_schema_embedding, search_space)
    
    # Step 4: Cosine similarity search between e(query) and e(existing_prev_queries_embed)
    query_embedding = openai_client.generate_embeddings(text=initial_query)
    initial_results = cos_sim_search(query_embedding, search_space, column_name="query_embed")
    return initial_results


def infer_hypothetical_schema(initial_query):
    prompt = format_prompt(PROMPT, query=initial_query)

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
                SELECT table_name, table_desc, table_tags, previous_queries, col_num, example_records, popularity, time_granu, geo_granu, 1 - ({column_name} <=> %s::VECTOR(1536)) AS cosine_similarity
                FROM corpus_raw_metadata_with_embedding
                WHERE table_name = ANY(%s)
                ORDER BY cosine_similarity DESC;
            """
            db.cursor.execute(query, (input_embedding, search_space))
        else:
            # No specific search space, search through all table names
            query = f"""
                SELECT table_name, table_desc, table_tags, previous_queries, col_num, example_records, popularity, time_granu, geo_granu, 1 - ({column_name} <=> %s::VECTOR(1536)) AS cosine_similarity
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
