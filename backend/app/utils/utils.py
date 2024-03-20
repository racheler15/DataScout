import json
from backend.app.db.connect_db import DatabaseConnection

def format_prompt(prompt_template, **kwargs):
    """ Formats a given prompt template with provided keyword arguments """
    return prompt_template.format(**kwargs)


def extract_time_geo_granularity(granularity_str):
    """ Extract time and geo granularity lists from a JSON string """
    granularity = json.loads(granularity_str)

    # Initialize empty sets for time and geographic granularities
    time_granu = set()
    geo_granu = set()

    # Iterate through each item in the granularity dictionary
    for value in granularity.values():
        # Check if 'temporal' key exists and has a non-null value
        if 'temporal' in value and value['temporal']:
            time_granu.add(value['temporal'])
        
        # Check if 'geographic' key exists and has a non-null value
        if 'geographic' in value and value['geographic']:
            geo_granu.add(value['geographic'])

    # Convert sets to lists for JSON serialization
    return list(time_granu), list(geo_granu)


def run_sql_file(filename):
    """ Executes the SQL statements contained within a file """
    with open(filename, 'r') as file:
        sql_script = file.read()

   # Use the DatabaseConnection context manager to get a cursor
    with DatabaseConnection() as cursor:
        try:
            # Split the script into individual statements if necessary
            sql_statements = sql_script.split(';')
            
            # Execute each statement individually
            for statement in sql_statements:
                # Strip whitespace and skip empty statements
                if statement.strip():
                    cursor.execute(statement.strip())
            # Commit the transaction
            cursor.connection.commit()
        except Exception as e:
            # Rollback the transaction on error
            cursor.connection.rollback()
            print(f"An error occurred: {e}")
            raise

def format_cos_sim_results(results):
    """ Format results returned from pgvector operations """
    formatted_results = []

    for row in results:
        formatted_result = {
            "table_name": row["table_name"],
            "cosine_similarity": row["cosine_similarity"]
        }
        formatted_results.append(formatted_result)
        
    return formatted_results
