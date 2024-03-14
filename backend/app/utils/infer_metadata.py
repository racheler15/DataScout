"""
- This script utilizes pre-trained GPT models to infer missing metadata crucial for enhancing semantic searches within datasets.
- Specifically, for our mock dataset corpus sourced from data.gov, the following metadata are missing, but we can infer them from `table_name`, `table_description`, and `example_records`:
    * Table schema: Outlines the structure and types of data within the table.
    * Previous queries: Suggests potential queries users might have used to find this data, aiding in understanding user search behavior.
    * Granularity: Determines the level of detail or precision of the data contained within the dataset.
- Upon successfully inferring missing metadata, the script integrates the new information back into the dataset corpus.
- The enriched corpus is then prepared for further processing, including embedding, to facilitate more efficient and effective dataset retrieval and utilization.
"""

from dotenv import load_dotenv
import os
from openai import OpenAI
import json

load_dotenv()

# Load the openai api key from .env file
client = OpenAI(api_key=os.environ['OPENAI_API_KEY'])

# Specify the GPT model we use for inference
MODEL = "gpt-3.5-turbo"

PROMPTS = {
    "schema_prompt": "Given a dataset titled '{table_name}' which includes data on {table_description}, with example records like {example_records}, what would a likely table schema be?",
    "query_prompt": "Considering a dataset titled '{table_name}' described as '{table_description}' with records such as {example_records}, what are some natural language queries users might have used to search for this data for task-based purposes?",
    "granularity_prompt": "Based on the dataset titled '{table_name}' which provides {table_description}, and considering example entries like {example_records}, can you determine the level of data granularity?"
}

def format_prompt(prompt_template, **kwargs):
    return prompt_template.format(**kwargs)

def infer_metadata_with_gptmodel(messages, model=MODEL):
    response = client.chat.completions.create(
        model=model,
        messages=messages
    )
    return response.choices[0].message.content

# TODO: FURTHER CRAFT THE PROMPTS USED FOR INFERENCE
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
    return infer_metadata_with_gptmodel(messages)

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
    return infer_metadata_with_gptmodel(messages)

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
    return infer_metadata_with_gptmodel(messages)

# Load the mock data
with open('mock_data/data_gov_mock_data.json', 'r') as file:
    mock_data_corpus = json.load(file)

for dataset in mock_data_corpus:
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

# Save the updated data back to a new JSON file
with open('mock_data/updated_data_gov_mock_data.json', 'w') as file:
    json.dump(mock_data_corpus, file, indent=2)