from backend.app.utils import run_sql_file
from connect_db import DatabaseConnection
import json


def insert_mock_data(file_path):
    # Load mock data
    with open(file_path, 'r') as f:
        mock_data_corpus = json.load(f)

    # Insert each record into the database
    insert_query = '''
    INSERT INTO corpus_raw_metadata_with_embedding (table_name, previous_queries, example_records, table_desc, table_tags, col_num, popularity, time_granu, geo_granu, comb_embed, query_embed)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (table_name) DO NOTHING;
    '''

    with DatabaseConnection() as db:
        for dataset in mock_data_corpus:
            table_name = dataset['Table name'].lower()
            table_desc = dataset["Table description"]
            col_num = dataset['Column numbers']
            popularity = dataset['Popularity']
            

            # Convert lists into PostgreSQL array directly without joining into strings
            # The lists are directly suitable for PostgreSQL TEXT[] type
            table_tags = [item.lower() for item in dataset['Table tags']] if dataset['Table tags'] else None
            time_granu = [item.lower() for item in dataset['Temporal granularity']] if dataset['Temporal granularity'] else None
            geo_granu = [item.lower() for item in dataset['Geographic granularity']] if dataset['Geographic granularity'] else None

            # Parse previous queries from JSON string
            previous_queries_json = dataset.get("Previous queries", "{}")
            previous_queries = json.loads(previous_queries_json).get("queries", [])  # Extract queries array

            example_records = dataset.get('Example records', [])
            example_records = json.dumps(example_records)
            comb_embed = dataset['Combined embedding']
            query_embed = dataset['Query embedding']
            
            # Execute the insert query
            db.cursor.execute(insert_query, (table_name, previous_queries, example_records, table_desc, table_tags, col_num, popularity, time_granu, geo_granu, comb_embed, query_embed))


def main():
    try:
        # Initialize database
        file = 'backend/app/db/initialize_db.sql'
        run_sql_file(file)
        print("🚀 Database initialized successfully.")

        # Insert mock data corpus into database
        insert_mock_data('mock_data/mock_data_with_embedding.json')

    except Exception as e:
        print(f"An error occurred: {e}")
        raise

if __name__ == "__main__":
    main()