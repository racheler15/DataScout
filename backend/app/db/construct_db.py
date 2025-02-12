import os
import json
import pandas as pd
from connect_db import DatabaseConnection
from backend.app.table_representation.openai_client import OpenAIClient
from backend.app.utils.utils import parse_list_column, parse_json_column
from psycopg2.extras import Json
import tiktoken

# OpenAI client instantiation
openai_client = OpenAIClient()

class MockData:
    def __init__(self, file_path):
        self.file_path = file_path

    def insert_mock_data(self):
        # Load mock data
        with open(self.file_path, 'r') as f:
            mock_data_corpus = json.load(f)

        # Insert each record into the database
        insert_query = '''
        INSERT INTO corpus_raw_metadata_with_embedding (table_name, col_num, popularity, time_granu, geo_granu, comb_embed, query_embed)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (table_name) DO NOTHING;
        '''

        with DatabaseConnection() as db:
            for dataset in mock_data_corpus:
                table_name = dataset['Table name'].lower()
                col_num = dataset['Column numbers']
                popularity = dataset['Popularity']

                # Convert lists into PostgreSQL array directly without joining into strings
                # The lists are directly suitable for PostgreSQL TEXT[] type
                time_granu = [item.lower() for item in dataset['Temporal granularity']] if dataset['Temporal granularity'] else None
                geo_granu = [item.lower() for item in dataset['Geographic granularity']] if dataset['Geographic granularity'] else None

                comb_embed = dataset['Combined embedding']
                query_embed = dataset['Query embedding']
                
                # Execute the insert query
                db.cursor.execute(insert_query, (table_name, col_num, popularity, time_granu, geo_granu, comb_embed, query_embed))

class EvalData:
    def __init__(self, openai_client):
        self.openai_client = openai_client
        # Mapping of CSV files to table names
        self.csv_table_mapping = {
            'eval_data_all.csv.gz': 'eval_data_all',
            # 'eval_data_test.csv.gz': 'eval_data_test',
            # 'eval_data_train.csv.gz': 'eval_data_train',
            # 'eval_data_validation.csv.gz': 'eval_data_validation'
        }
        # Path to the CSV files directory
        self.csv_files_path = 'eval/eval_data_processed'
    
    def truncate_example_rows_md(self, text, max_tokens, num_rows=3):
        lines = text.strip().split('\n')
        if len(lines) < 2:
            return text  # Return as is if there is no separator line

        # Find the separator line
        separator_index = None
        for idx, line in enumerate(lines):
            if set(line.strip()) == set('| -'):
                separator_index = idx
                break
        if separator_index is None:
            separator_index = 1  # Default to the second line if separator not found

        # Compute the end index to include header, separator, and data rows
        end_index = separator_index + 1 + num_rows
        truncated_lines = lines[:end_index]
        truncated_text = '\n'.join(truncated_lines)

        # If max_tokens is specified, further truncate based on token count
        if max_tokens is not None:
            # Initialize the tokenizer
            tokenizer = tiktoken.encoding_for_model('text-embedding-3-small')
            tokens = tokenizer.encode(truncated_text)
            if len(tokens) > max_tokens:
                # Truncate tokens and decode back to text
                tokens = tokens[:max_tokens]
                truncated_text = tokenizer.decode(tokens)

        return truncated_text

    def compute_embedding(self, text):
        if text:
            # Define the maximum token limit (8000 tokens to be safe vs. 8192 maximum)
            MAX_TOKENS = 8000
            num_rows = 3  # Start with 3 data rows

            while num_rows >= 0:
                truncated_text = self.truncate_example_rows_md(text, max_tokens=MAX_TOKENS, num_rows=num_rows)
                tokenizer = tiktoken.encoding_for_model('text-embedding-3-small')
                tokens = tokenizer.encode(truncated_text)
                if len(tokens) <= MAX_TOKENS:
                    break
                num_rows -= 1  # Reduce the number of data rows

            if num_rows < 0:
                print("Unable to truncate text to within token limit.")
                return None

            try:
                return self.openai_client.generate_embeddings(truncated_text)
            except Exception as e:
                print(f"Error generating embeddings: {e}")
                return None
        else:
            return None
    
    def create_table_if_not_exists(self, db, table_name):
        create_table_query = f'''
        CREATE TABLE IF NOT EXISTS {table_name} (
            table_name TEXT,
            database_name TEXT,
            example_rows_md TEXT,
            time_granu TEXT,
            geo_granu TEXT,
            db_description TEXT,
            col_num INT,
            row_num INT,
            popularity INT,
            usability_rating DECIMAL,
            tags TEXT[],
            file_size_in_byte INT,
            keywords TEXT[],
            task_queries TEXT[],
            metadata_queries JSONB,
            example_rows_embed VECTOR(1536)
        );
        '''
        db.cursor.execute(create_table_query)

        # Create index on the embedding column for efficient similarity search
        index_query = f'''
        CREATE INDEX IF NOT EXISTS {table_name}_example_rows_embed_idx
        ON {table_name} USING hnsw (example_rows_embed vector_cosine_ops) WITH (m = 16, ef_construction = 64);
        '''
        db.cursor.execute(index_query)
    
    def insert_eval_data(self):
        with DatabaseConnection() as db:
            # Enable the pgvector extension
            db.cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            db.conn.commit()
            print("✅ pgvector extension enabled successfully.")

            for csv_file, table_name in self.csv_table_mapping.items():
                csv_file_path = os.path.join(self.csv_files_path, csv_file)
                if not os.path.exists(csv_file_path):
                    print(f"CSV file {csv_file_path} does not exist.")
                    continue

                print(f"⏳ Processing {csv_file_path} into table {table_name}.")

                # Create the table if it does not exist
                self.create_table_if_not_exists(db, table_name)

                # Read the CSV file
                df = pd.read_csv(csv_file_path)

                # Prepare the insert query
                insert_query = f'''
                INSERT INTO {table_name} (
                    table_name,
                    database_name,
                    example_rows_md,
                    time_granu,
                    geo_granu,
                    db_description,
                    col_num,
                    row_num,
                    popularity,
                    usability_rating,
                    tags,
                    file_size_in_byte,
                    keywords,
                    task_queries,
                    metadata_queries,
                    example_rows_embed
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                '''

                # Iterate over the DataFrame rows
                for index, row in df.iterrows():
                    try:
                        # Map CSV columns to table columns
                        table_name_val = str(row['File Name']) if 'File Name' in df.columns else None
                        database_name = str(row['Dataset Name']) if 'Dataset Name' in df.columns else None
                        example_rows_md = str(row['Example Rows']) if 'Example Rows' in df.columns else None
                        time_granu = str(row['Time Granularity']) if 'Time Granularity' in df.columns else None
                        geo_granu = str(row['Geographic Granularity']) if 'Geographic Granularity' in df.columns else None
                        db_description = str(row['Description']) if 'Description' in df.columns else None
                        col_num = int(row['Number of Columns']) if pd.notna(row.get('Number of Columns')) else None
                        row_num = int(row['Number of Rows']) if pd.notna(row.get('Number of Rows')) else None
                        popularity = int(row['Popularity']) if pd.notna(row.get('Popularity')) else None
                        usability_rating = float(row['Usability Rating']) if pd.notna(row.get('Usability Rating')) else None
                        file_size_in_byte = int(row['File Size (bytes)']) if pd.notna(row.get('File Size (bytes)')) else None

                        # Parse list-like columns
                        tags = parse_list_column(row['Tags']) if 'Tags' in df.columns else []
                        keywords = parse_list_column(row['Keywords']) if 'Keywords' in df.columns else []
                        task_queries = parse_list_column(row['Task Queries']) if 'Task Queries' in df.columns else []
                        metadata_queries = parse_json_column(row['Metadata Queries']) if 'Metadata Queries' in df.columns else None

                        # Compute embedding for example_rows_md
                        example_rows_embed = self.compute_embedding(example_rows_md)

                        # Insert data into the table
                        db.cursor.execute(
                            insert_query,
                            (
                                table_name_val,
                                database_name,
                                example_rows_md,
                                time_granu,
                                geo_granu,
                                db_description,
                                col_num,
                                row_num,
                                popularity,
                                usability_rating,
                                tags,
                                file_size_in_byte,
                                keywords,
                                task_queries,
                                Json(metadata_queries) if metadata_queries is not None else None,
                                example_rows_embed
                            )
                        )           
                
                    except Exception as e:
                        print(f"Error processing row {index} in file {csv_file_path}: {e}")
                        continue          
                db.cursor.execute("SELECT * FROM eval_data_all LIMIT 5;")
                rows = db.cursor.fetchall()
                print(rows)     

        print("✅ Evaluation data inserted successfully from CSV files.")

    def insert_eval_data_processed(self):
        with DatabaseConnection() as db:
            # Enable the pgvector extension
            db.cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            db.conn.commit()
            print("✅ pgvector extension enabled successfully.")

            for csv_file, table_name in self.csv_table_mapping.items():
                csv_file_path = os.path.join(self.csv_files_path, csv_file)
                if not os.path.exists(csv_file_path):
                    print(f"CSV file {csv_file_path} does not exist.")
                    continue

                print(f"⏳ Processing {csv_file_path} into table {table_name}.")

                # Create the table if it does not exist
                self.create_table_if_not_exists(db, table_name)

                # Read the CSV file
                df = pd.read_csv(csv_file_path)

                # Prepare the insert query
                insert_query = f'''
                INSERT INTO {table_name} (
                    table_name,
                    database_name,
                    example_rows_md,
                    time_granu,
                    geo_granu,
                    db_description,
                    col_num,
                    row_num,
                    popularity,
                    usability_rating,
                    tags,
                    file_size_in_byte,
                    keywords,
                    task_queries,
                    metadata_queries,
                    example_rows_embed
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                '''

                # Iterate over the DataFrame rows
                for index, row in df.iterrows():

                    try:
                        if index == 5545:
                            print(row)
                            print(row[table_name])
                            
                        # Map CSV columns to table columns
                        table_name_val = str(row[table_name])
                        database_name = str(row[database_name])
                        example_rows_md = str(row[example_rows_embed])
                        time_granu = str(row[time_granu])
                        geo_granu = str(row[geo_granu])
                        db_description = str(row[db_description])
                        col_num = int(row[col_num])
                        row_num = int(row[row_num])
                        popularity = int(row[popularity])
                        usability_rating = float(row[usability_rating])
                        file_size_in_byte = int(row[file_size_in_byte])

                        # Parse list-like columns
                        # tags = parse_list_column(row['tags']) if 'Tags' in df.columns else []
                        # keywords = parse_list_column(row['keywords']) if 'Keywords' in df.columns else []
                        # task_queries = parse_list_column(row['task_queries']) if 'Task Queries' in df.columns else []
                        # metadata_queries = parse_json_column(row['metadata_queries']) if 'Metadata Queries' in df.columns else None
                        tags = None
                        keywords = None
                        task_queries = None
                        metadata_queries = None

                        # Compute embedding for example_rows_md
                        example_rows_embed = self.compute_embedding(example_rows_md)

                        # Insert data into the table
                        db.cursor.execute(
                            insert_query,
                            (
                                table_name_val,
                                database_name,
                                example_rows_md,
                                time_granu,
                                geo_granu,
                                db_description,
                                col_num,
                                row_num,
                                popularity,
                                usability_rating,
                                tags,
                                file_size_in_byte,
                                keywords,
                                task_queries,
                                Json(metadata_queries) if metadata_queries is not None else None,
                                example_rows_embed
                            )
                        )           
                
                    except Exception as e:
                        print(f"Error processing row {index} in file {csv_file_path}: {e}")
                        continue          
                # db.cursor.execute("SELECT * FROM eval_data_all LIMIT 5;")
                # rows = db.cursor.fetchall()
                # print(rows)     

        print("✅ Evaluation data processed inserted successfully from CSV files.")

    def initialize_eval_hyse_schemas_table(self):
        create_table_query = """
        CREATE TABLE IF NOT EXISTS eval_hyse_schemas (
            query TEXT NOT NULL,
            hypo_schema_id SERIAL,
            hypo_schema TEXT,
            hypo_schema_embed VECTOR(1536),
            PRIMARY KEY (query, hypo_schema_id)
        );
        """
        
        with DatabaseConnection() as db:
            # Enable the pgvector extension
            db.cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            db.cursor.execute(create_table_query)
            db.conn.commit() 
            print("✅ eval_hyse_schemas table created successfully.")

            # Create index on the embedding column for efficient similarity search
            index_query = """
            CREATE INDEX IF NOT EXISTS hypo_schema_embed_idx
            ON eval_hyse_schemas USING hnsw (hypo_schema_embed vector_cosine_ops) WITH (m = 16, ef_construction = 64);
            """
            db.cursor.execute(index_query)
            db.conn.commit()
            print("✅ Index hypo_schema_embed_idx created successfully.")
    
    def initialize_eval_query_embeds_table(self):
        create_table_query = """
        CREATE TABLE IF NOT EXISTS eval_query_embeds (
            query TEXT NOT NULL PRIMARY KEY,
            query_embed VECTOR(1536)
        );
        """
        
        with DatabaseConnection() as db:
            # Enable the pgvector extension
            db.cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            db.cursor.execute(create_table_query)
            db.conn.commit() 
            print("✅ eval_query_embeds table created successfully.")

            # Create index on the embedding column for efficient similarity search
            index_query = """
            CREATE INDEX IF NOT EXISTS query_embed_idx
            ON eval_query_embeds USING hnsw (query_embed vector_cosine_ops) WITH (m = 16, ef_construction = 64);
            """
            db.cursor.execute(index_query)
            db.conn.commit()
            print("✅ Index query_embed_idx created successfully.")
    
    def initialize_eval_keyword_embeds_table(self):
        create_table_query = """
        CREATE TABLE IF NOT EXISTS eval_keyword_embeds (
            keyword TEXT NOT NULL PRIMARY KEY,
            keyword_embed VECTOR(1536)
        );
        """
        
        with DatabaseConnection() as db:
            # Enable the pgvector extension
            db.cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            db.cursor.execute(create_table_query)
            db.conn.commit() 
            print("✅ eval_keyword_embeds table created successfully.")

            # Create index on the embedding column for efficient similarity search
            index_query = """
            CREATE INDEX IF NOT EXISTS keyword_embed_idx
            ON eval_keyword_embeds USING hnsw (keyword_embed vector_cosine_ops) WITH (m = 16, ef_construction = 64);
            """
            db.cursor.execute(index_query)
            db.conn.commit()
            print("✅ Index keyword_embed_idx created successfully.")

def main():
    try:
        # # Initialize database
        # file = 'backend/app/db/initialize_db.sql'
        # run_sql_file(file)
        # print("🚀 Database initialized successfully.")

        # # Insert mock data corpus into database
        # mock_data = MockData('mock_data/mock_data_with_embedding.json')
        # mock_data.insert_mock_data()

        # Insert evaluation data
        eval_data = EvalData(openai_client)
        # eval_data.insert_eval_data()
        # eval_data.insert_eval_data_processed()

        eval_data.initialize_eval_hyse_schemas_table()
        # eval_data.initialize_eval_query_embeds_table()
        eval_data.initialize_eval_keyword_embeds_table()
        print("🚀 Database initialized successfully.")
    except Exception as e:
        print(f"An error occurred: {e}")
        raise

if __name__ == "__main__":
    main()