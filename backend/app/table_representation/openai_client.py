from dotenv import load_dotenv
import os
# from openai import OpenAI
from openai import AzureOpenAI

load_dotenv()

class OpenAIClient:
    def __init__(self):
        # self.client = OpenAI(api_key=os.environ['OPENAI_API_KEY'])
        # self.text_generation_model_default = "gpt-3.5-turbo"
        # self.embedding_model_default = "text-embedding-3-small"
        self.client = AzureOpenAI(
            azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT"), 
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),  
            api_version="2023-07-01-preview"
        ) 
        self.text_generation_model_default = "gpt-35-infer-model"
        self.embedding_model_default = "gpt-4-embed-ada-model"

    def infer_metadata(self, messages, model=None):
        if model is None:
            model = self.text_generation_model_default
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=messages
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error inferring metadata: {e}")
            return

    def generate_embeddings(self, text, model=None):
        if model is None:
            model = self.embedding_model_default
        try:
            text = text.replace("\n", " ")
            response = self.client.embeddings.create(
                model=model,
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"Error generating embeddings: {e}")
            return