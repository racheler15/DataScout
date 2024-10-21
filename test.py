from openai import OpenAI
from dotenv import load_dotenv
import os
from autogen import AssistantAgent, UserProxyAgent, GroupChat, GroupChatManager, config_list_from_json
from backend.app.table_representation.openai_client import OpenAIClient
from backend.app.hyse.hypo_schema_search import hyse_search, most_popular_datasets
from backend.app.actions.infer_action import infer_action, infer_mentioned_metadata_fields, prune_query
from backend.app.actions.handle_action import handle_semantic_fields, handle_raw_fields
from backend.app.chat.handle_chat_history import append_user_query, append_system_response, get_user_queries, get_last_results, get_mentioned_fields


load_dotenv()
client = OpenAI()

def main():
    user_query = "I want a dataset on a classification model for presidential elections."
    initial_results = hyse_search(user_query, search_space=None)
    print("Number of datasets found:", len(initial_results))

    # Ensure there are results to proceed with
    if not initial_results:
        print("No datasets found. Please refine your query.")
        return
    
    # example LLM config for the entrypoint agent
    llm_config = {"config_list": [{"model": "gpt-4o-mini", "api_key": os.environ.get('OPENAI_API_KEY')}]}
    
    user_proxy = UserProxyAgent("user_proxy", 
                                        system_message="A human admin.", 
                                        llm_config=llm_config)
    
    query_refiner = AssistantAgent(name="query_refiner", 
                                   system_message="""You are a helpful assistant that helps refine the query. Refine on the semantics of the task for initial queries. Once search space is less than 100 datasets, generate queries to help refine on the avaliable metadata.""",
                                   llm_config=llm_config
                                   )
    
    metadata_agent = AssistantAgent(name="metadata_agent", 
                                   system_message="""You are a helpful assistant that presents the top 3 metadata attributes that users can query over, to reduce the search space by half. """,
                                   llm_config=llm_config
                                   )
    
    groupchat = GroupChat(agents=[user_proxy, query_refiner, metadata_agent], messages=[], max_round = 9)
    manager = GroupChatManager(groupchat=groupchat, llm_config=llm_config)

    chat_result = user_proxy.initiate_chat(manager, message= f"{user_query} Here are the datasets: {initial_results}", summary_method="reflection_with_llm")
    print(chat_result.summary)
    
if __name__ == "__main__":
    main()