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
    "column_specification": "TEXT",
    "table_name": "TEXT",
    "database_name": "TEXT",
    "time_granularity": "TEXT",
    "geo_granularity": "TEXT",
    "db_description": "TEXT",
    "col_num": "INT",
    "row_num": "INT",
    "total downloads": "INT",
    "usability_rating": "DECIMAL",
    "tags": "TEXT[]",
    "file_size_in_MB": "INT",
    "keywords": "TEXT[]",

    
}

metadata_filtering_operations = {
    "column_specification": ["includes"],
    "table_name": ["includes"],
    "database_name": ["includes"],
    "time_granularity": ["is"],
    "geo_granularity": ["is"],
    "db_description": ["includes"],
    "col_num": [">", "<", ">=", "<=", "="],
    "row_num": [">", "<", ">=", "<=", "="],
    "total downloads": [">", "<", ">=", "<=", "="],
    "usability_rating": [">", "<", ">=", "<=", "="],
    "tags": ["includes"],
    "file_size_in_MB": [">", "<", ">=", "<=", "="],
    "keywords": ["includes"],

}

metadata_values = {
    "column_specification": [],
    "table_name": [],
    "database_name": [],
    "time_granularity": ['decade', 'day', 'half hour', 'hour', 'match', 'millisecond', 'minute', 'month', 'months', 'patch', 'quarter', 'season', 'second', 'version', 'week', 'weekday', 'year', '30 minutes'],
    "geo_granularity": ['city', 'comuna', 'continent', 'country', 'county', 'district', 'global', 'island', 'latitude/longitude', 'location', 'neighbourhood', 'postal code', 'prefecture', 'province', 'region', 'state', 'store', 'zip code', 'world'],
    "db_description": [],
    "col_num": [],
    "row_num": [],
    "total downloads": [],
    "usability_rating": [],
    "tags": [],
    "file_size_in_MB": [],
    "keywords": [],

    
}

metadata_descriptions = {
    "column_specification": "Search over column name.",
    "table_name": "Name of the table.",
    "database_name": "Name of the database.",
    "time_granularity": "Time granularity (e.g., Year, Month).",
    "geo_granularity": "Geographic granularity (e.g., Country, City).",
    "db_description": "Short description of the dataset.",
    "col_num": "Number of columns in the table.",
    "row_num": "Number of rows in the table.",
    "total downloads": "Number of total downloads for the dataset.",
    "usability_rating": "User rating of dataset usability, scale from 0% to 100%.",
    "tags": "Tags associated with the dataset.",
    "file_size_in_MB": "Size of the dataset in megabytes.",
    "keywords": "Keywords related to the dataset.",
}
