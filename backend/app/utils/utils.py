import json
from backend.app.db.connect_db import DatabaseConnection

def format_prompt(prompt_template, **kwargs):
    """ Formats a given prompt template with provided keyword arguments """
    return prompt_template.format(**kwargs)


def extract_time_geo_granularity(granularity_str):
    """ Extract time and geo granularity lists from a JSON string """
    granularity = json.loads(granularity_str)
    
    # Convert sets to lists for JSON serialization
    time_granu = list({value["temporal"] for key, value in granularity.items() if value["temporal"]})
    geo_granu = list({value["geographic"] for key, value in granularity.items() if value["geographic"]})

    return time_granu, geo_granu



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
