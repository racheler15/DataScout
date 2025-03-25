import os
import json
import pandas as pd
from connect_db import DatabaseConnection
from backend.app.table_representation.openai_client import OpenAIClient
from backend.app.utils.utils import parse_list_column, parse_json_column
from psycopg2.extras import Json
import tiktoken
import hnswlib
import ast
import logging


# OpenAI client instantiation
openai_client = OpenAIClient()

# Connect to PostgreSQL
def create_column_embeddings_table():
    with DatabaseConnection() as db:
        query = """
        CREATE TABLE IF NOT EXISTS eval_final_all_user_study_column_embeddings (
            eval_row_id SERIAL PRIMARY KEY,  -- Unique row in new table
            table_name TEXT NOT NULL,  -- Reference to the table_name in eval_final_all_user_study
            column_name TEXT NOT NULL,  -- Column name within the dataset
            embedding VECTOR(1536)  -- Store the embedding vector
        );
        """
        db.cursor.execute(query)
        db.conn.commit()

        # Create index using HNSW for efficient nearest neighbor search
        index_query = """
        CREATE INDEX IF NOT EXISTS eval_final_all_user_study_column_embeddings_idx
        ON eval_final_all_user_study_column_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
        """
        db.cursor.execute(index_query)
        db.conn.commit()
        print("✅ Index eval_final_all_user_study_column_embeddings_idx created successfully.")


def insert_column_embeddings():
    with DatabaseConnection() as db:
        db.cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        db.conn.commit()
        print("✅ pgvector extension enabled successfully.")

        table_name = 'eval_final_all_user_study'
        csv_file_path = "/Users/raelin/HITS/scripts/userstudy_processed.csv"
        if not os.path.exists(csv_file_path):
            print(f"CSV file {csv_file_path} does not exist.")
            return

        print(f"⏳ Processing {csv_file_path} into table {table_name}.")

        # Create the table if it does not exist
        create_column_embeddings_table()

        # Read the CSV file
        df = pd.read_csv(csv_file_path)

        # Query to fetch the rows from eval_cols_test
        query = "SELECT table_name, example_cols_embed FROM eval_final_all_user_study"
        db.cursor.execute(query)
        rows = db.cursor.fetchall()
        print(rows[0:5])

        insert_query = """
        INSERT INTO eval_final_all_user_study_column_embeddings (table_name, column_name, embedding)
        VALUES (%s, %s, %s)
        """

        for index, row in df.iterrows():
            try:
                table_name = str(row['table_name']) if 'table_name' in df.columns else None
                example_cols_embed_dict = ast.literal_eval(row['example_cols_embed'])
                for col_name, embedding in example_cols_embed_dict.items(): 
                    print(f"processing row {index}: {col_name}, {len(embedding)}")
                    db.cursor.execute(insert_query, (table_name, col_name, embedding))
            except Exception as e:
                        print(f"Error processing row {index} in file {csv_file_path}: {e}")
                        continue  
            

        db.conn.commit()
        print("✅ Column embeddings inserted successfully.")


# Example of how you can use both functions
# create_column_embeddings_table()  # First create the table and index
insert_column_embeddings()  # Then insert the embeddings into the table
