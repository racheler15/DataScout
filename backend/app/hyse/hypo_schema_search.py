from backend.app.table_representation.openai_client import OpenAIClient
from backend.app.utils import format_prompt, format_cos_sim_results
from backend.app.db.connect_db import DatabaseConnection

# Initialize OpenAI client
openai_client = OpenAIClient()

# Craft schema inference prompt
PROMPT = """
Given the objective of {query}, help me generate a hypothetical table schema to support this.
Only generate one table schema, excluding any introductory phrases and focusing exclusively on the tasks themselves.
"""

def hyse_search(initial_query):
    # Step 1: Infer hypothetical schema
    hypo_schema = infer_hypothetical_schema(initial_query)

    # Step 2: Generate embedding for the hypothetical schema
    hypo_schema_embedding = openai_client.generate_embeddings(text=hypo_schema)

    # Step 3: Cosine similarity search between e(hypo_schema_embed) and e(existing_scheme_embed)
    initial_results = cos_sim_search(hypo_schema_embedding)
    initial_results_formatted = format_cos_sim_results(initial_results)
    
    # print(initial_results_formatted)
    return initial_results_formatted


def infer_hypothetical_schema(initial_query):
    prompt = format_prompt(PROMPT, query=initial_query)

    messages = [
        {"role": "system", "content": "You are an assistant skilled in generating database schemas."},
        {"role": "user", "content": prompt}
    ]

    return openai_client.infer_metadata(messages)

def cos_sim_search(input_embedding, column_name="comb_embed"):
    if column_name not in ["comb_embed", "query_embed"]:
        raise ValueError("Invalid embedding column")
    
    with DatabaseConnection() as cursor:
        query = f"""
            SELECT table_name, 1 - ({column_name} <=> %s::VECTOR(1536)) AS cosine_similarity
            FROM corpus_raw_metadata_with_embedding
            ORDER BY cosine_similarity DESC;
        """

        cursor.execute(query, (input_embedding,))
        results = cursor.fetchall()
    
    return results

# hyse_search("Analyze the distribution of electric vehicles by city")
