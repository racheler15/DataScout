table_schema_dict = {
    "table_name": "TEXT",
    "database_name": "TEXT",
    "example_rows_md": "TEXT",
    "time_granu": "TEXT",
    "geo_granu": "TEXT",
    "db_description": "TEXT",
    "col_num": "INT",
    "row_num": "INT",
    "popularity": "INT",
    "usability_rating": "DECIMAL",
    "tags": "TEXT[]",
    "file_size_in_byte": "INT",
    "keywords": "TEXT[]",
    "task_queries": "TEXT[]",
    "metadata_queries": "JSONB",
    "example_rows_embed": "VECTOR(1536)",
    "example_cows_embed": "TEXT"
}

table_schema_dict_frontend = {
    "table_name": "TEXT",
    "database_name": "TEXT",
    "db_description": "TEXT",
    "col_num": "INT",
    "row_num": "INT",
    "popularity": "INT",
    "usability_rating": "DECIMAL",
    "tags": "TEXT[]",
    "file_size_in_byte": "INT",    
}

metadata_filtering_operations = {
    "table_name": ["includes"],
    "database_name": ["includes"],
    "db_description": ["includes"],
    "col_num": [">", "<", ">=", "<=", "="],
    "row_num": [">", "<", ">=", "<=", "="],
    "popularity": [">", "<", ">=", "<=", "="],
    "usability_rating": [">", "<", ">=", "<=", "="],
    "tags": ["includes"],
    "file_size_in_byte": [">", "<", ">=", "<=", "="],
}

metadata_values = {
    "table_name": [],
    "database_name": [],
    "db_description": [],
    "col_num": [],
    "row_num": [],
    "popularity": [],
    "usability_rating": [],
    "tags": [],
    "file_size_in_byte": [],
    
}

metadata_descriptions = {
    "table_name": "Name of the table.",
    "database_name": "Name of the database.",
    "db_description": "Short description of the dataset.",
    "col_num": "Number of columns in the table.",
    "row_num": "Number of rows in the table.",
    "popularity": "Number of total downloads for the dataset.",
    "usability_rating": "User rating of dataset usability, scale from 0% to 100%.",
    "tags": "Tags associated with the dataset.",
    "file_size_in_byte": "Size of the dataset in bytes.",
}
