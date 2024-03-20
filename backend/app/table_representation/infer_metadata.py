"""
- This script utilizes pre-trained GPT models to infer missing metadata crucial for enhancing semantic searches within datasets.
- Specifically, for our mock dataset corpus sourced from data.gov, the following metadata are missing, but we can infer them from `table_name`, `table_description`, and `example_records`:
    * Table schema: Outlines the structure and types of data within the table.
    * Previous queries: Suggests potential queries users might have used to find this data, aiding in understanding user search behavior.
    * Granularity: Determines the level of detail or precision of the data contained within the dataset.
- Upon successfully inferring missing metadata, the script integrates the new information back into the dataset corpus.
- The enriched corpus is then prepared for further processing, including embedding, to facilitate more efficient and effective dataset retrieval and utilization.
"""

import json
from tqdm import tqdm
from .openai_client import OpenAIClient
from backend.app.utils import format_prompt, extract_time_geo_granularity

# Initialize OpenAI client
openai_client = OpenAIClient()

# Craft metadata inference prompts
PROMPTS = {
    "schema_prompt": "Given the dataset titled '{table_name}' which includes data on {table_description}, with example records like {example_records}, directly list the likely table schema. Please provide this schema as a concise list of column names followed by their data types, without any introductory text, commentary, or conclusion. Format the schema details in a straightforward manner, with each column and data type on a new line.",
    "query_prompt": "Please provide some data analytics tasks (e.g. data analysis, machine learning, business intelligence, etc.) that can be performed for the table titled '{table_name}' which includes data on {table_description}, with example records like {example_records}? Specify the analytics tasks specific to the semantics of the table, and provide all tasks (without categorization) in a flat list, excluding any introductory phrases and focusing exclusively on the tasks themselves.",
    "granularity_prompt": "Given a dataset titled '{table_name}' with data on {table_description} and example records like {example_records}, identify columns that express some granularity. For each identified column, determine if it relates to geographic or temporal attributes. Provide the results in a compact, single-line JSON format. Do not include markdown or additional annotations. The expected JSON structure is {{column_name: {{temporal: 'temporal_granularity', geographic: 'geographic_granularity'}}}}. Include only columns that have granularity attributes, and minimize whitespace in the output."
}

def infer_table_schema(table_name, table_description, example_records):
    prompt = format_prompt(
        PROMPTS['schema_prompt'], 
        table_name=table_name, 
        table_description=table_description, 
        example_records=json.dumps(example_records)
    )
    messages = [
        {"role": "system", "content": "You are an assistant skilled in database schemas."},
        {"role": "user", "content": prompt}
    ]
    return openai_client.infer_metadata(messages)

def infer_previous_queries(table_name, table_description, example_records):
    prompt = format_prompt(
        PROMPTS['query_prompt'], 
        table_name=table_name, 
        table_description=table_description, 
        example_records=json.dumps(example_records)
    )
    messages = [
        {"role": "system", "content": "You are an assistant providing possible user queries for datasets."},
        {"role": "user", "content": prompt}
    ]
    return openai_client.infer_metadata(messages)

def infer_granularity(table_name, table_description, example_records):
    prompt = format_prompt(
        PROMPTS['granularity_prompt'], 
        table_name=table_name, 
        table_description=table_description, 
        example_records=json.dumps(example_records)
    )
    messages = [
        {"role": "system", "content": "You are an assistant skilled in determining data granularity."},
        {"role": "user", "content": prompt}
    ]
    return openai_client.infer_metadata(messages)

# Load the mock data
with open('mock_data/data_gov_mock_data.json', 'r') as file:
    mock_data_corpus = json.load(file)

for dataset in tqdm(mock_data_corpus, desc="Processing datasets"):
    table_name = dataset['Table name']
    table_description = dataset['Table description']
    example_records = dataset['Example records']

    # Call OpenAI API to infer unspecified metadata
    dataset['Table schema'] = infer_table_schema(
        table_name=dataset['Table name'], 
        table_description=dataset['Table description'], 
        example_records=dataset['Example records']
    )

    dataset['Previous queries'] = infer_previous_queries(
        table_name=dataset['Table name'], 
        table_description=dataset['Table description'], 
        example_records=dataset['Example records']
    )

    dataset['Granularity'] = infer_granularity(
        table_name=dataset['Table name'], 
        table_description=dataset['Table description'], 
        example_records=dataset['Example records']
    )

    # Extract the time/geo granularity
    dataset['Temporal granularity'] = extract_time_geo_granularity(dataset['Granularity'])[0]
    dataset['Geographic granularity'] = extract_time_geo_granularity(dataset['Granularity'])[1]

# Save the updated data back to a new JSON file
with open('mock_data/updated_data_gov_mock_data.json', 'w') as file:
    json.dump(mock_data_corpus, file, indent=2)