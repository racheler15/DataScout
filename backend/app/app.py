from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from uuid import uuid4
import logging
from backend.app.table_representation.openai_client import OpenAIClient
from backend.app.hyse.hypo_schema_search import hyse_search, most_popular_datasets, get_datasets
from backend.app.actions.infer_action import infer_action, infer_mentioned_metadata_fields, prune_query
from backend.app.actions.handle_action import handle_semantic_fields, handle_raw_fields
from backend.app.chat.handle_chat_history import append_user_query, append_system_response, get_user_queries, get_last_results, get_mentioned_fields
import os
import time
import asyncio
import threading
import queue
from typing import List, Dict, Any
import autogen
from autogen import AssistantAgent, UserProxyAgent, GroupChat, GroupChatManager, ConversableAgent, Agent
from autogen import register_function
from collections import Counter
import matplotlib.pyplot as plt

import plotly.graph_objs as go
import plotly.io as pio
import statistics
import re
import json



# Flask app configuration
app = Flask(__name__)
CORS(app)

chat_status = "ended"

# Queues for single-user setup
print_queue = queue.Queue()
user_queue = queue.Queue()
task_query = ""
metadata_filters = []

# OpenAI client instantiation
openai_client = OpenAIClient()

# Logging configuration
logging.basicConfig(level=logging.INFO)

# In-memory storage for chat history
# TODO: Use server-side session to store chat histories
chat_history = {}

llm_config = {
    "config_list": [
        {"model": "gpt-4o-mini", "api_key": os.environ.get('OPENAI_API_KEY')}
    ]
}

table_schema_dict = {
"table_name": "TEXT PRIMARY KEY",
"table_schema": "TEXT[]",
"table_desc": "TEXT",
"table_tags": "TEXT[]",
"previous_queries": "TEXT[]",
"example_records": "JSONB",
"col_num": "INT",
"popularity": "INT",
"time_granu": "TEXT[]",
"geo_granu": "TEXT[]",
"comb_embed": "VECTOR(1536)",
"query_embed": "VECTOR(1536)",
"table_category": "TEXT"
    }

# https://www.youtube.com/watch?v=4mO2TmDervU&ab_channel=YeyuLab

#########
# When start chat session, create a new thread (conversation session between an Assistant and a user).
#########
@app.route('/api/start_chat', methods=['POST']) #post = submitting data ==> creating a new chat session
def start_new_chat_session():
    logging.info(f"starting new chat session")
    # Generate a unique session/thread ID
    thread_id = str(uuid4())
    # Initialize the chat history for this thread; messages stored as list
    chat_history[thread_id] = []
    # Return the thread_id to the client
    return jsonify({"thread_id": thread_id})


@app.route('/api/get_chat_history', methods=['GET'])
def get_chat_history():
    logging.info(f"getting chat history")
    # Extract thread_id from the request's query parameters
    thread_id = request.args.get('thread_id')
    
    # Check if thread_id is provided and valid
    if thread_id and thread_id in chat_history:
        # Return the chat history for the given thread_id
        return jsonify({
            "success": True,
            "thread_id": thread_id,
            "chat_history": chat_history[thread_id]
        })
    else:
        # Return an error message if thread_id is not provided or invalid
        return jsonify({
            "success": False,
            "error": "Invalid or missing thread_id"
        }), 400

#########
# This function processes incoming POST requests to update the chat history.
#########
@app.route('/api/update_chat_history', methods=['POST'])
def update_chat_history():
    logging.info(f"updating chat history")
    data = request.get_json()
    thread_id, query = data.get('thread_id'), data.get('query')

    # Validate thread_id and query presence
    if not thread_id or thread_id not in chat_history:
        return jsonify({"success": False, "error": "Invalid or missing thread_id"}), 400
    if not query:
        return jsonify({"success": False, "error": "Missing query content"}), 400

    try:
        # Identify metadata fields
        # TODO: Make sure for user's initial query, mention_semantic_fields is always True
        semantic_fields_identified = infer_mentioned_metadata_fields(cur_query=query, semantic_metadata=True).get_true_fields()
        raw_fields_identified = infer_mentioned_metadata_fields(cur_query=query, semantic_metadata=False).get_true_fields()

        # Update chat history with additional metadata field information
        append_user_query(chat_history, thread_id, query, bool(semantic_fields_identified), bool(raw_fields_identified))
        # logging.info(f"💬 Current chat history: {chat_history}")
        logging.info(f"💬 Number of threads in chat history: {len(chat_history)}")

        return jsonify({
                "success": True,
                "thread_id": thread_id,
                "chat_history": chat_history[thread_id]
        })
    except Exception as e:
        logging.error(f"Update chat history failed for thread: {thread_id}, Error: {e}")
        return jsonify({"error": "Update chat history failed due to an internal error"}), 500

#########
# This function does returns 10 most popular datasets when component first mounts.
#########
@app.route('/api/most_popular_datasets', methods=['GET'])
def get_most_popular_datasets():
    logging.info(f"fetching most popular datasets")
    popular_results = most_popular_datasets()
    return jsonify(popular_results)


#########
# This function does first initial hyse_search based on first query.
#########
@app.route('/api/hyse_search', methods=['POST'])
def initial_search():
    logging.info(f"first hyse search")
    thread_id = request.get_json().get('thread_id')
    initial_query = request.json.get('query')

    if not initial_query or len(initial_query.strip()) == 0:
        logging.error("Empty query provided")
        return jsonify({"error": "No query provided"}), 400

    try:
        initial_results = hyse_search(initial_query, search_space=None)
        append_system_response(chat_history, thread_id, initial_results, refine_type="semantic")

        # Update the cached results
        chat_history[thread_id + '_cached_results'] = [result["table_name"] for result in initial_results]

        response_data = {
            "top_results": initial_results[:10],
            "complete_results": initial_results,
        }

        logging.info(f"✅Search successful for query: {initial_query}")
        logging.info(f"💬 Current chat history: {chat_history}")

        return jsonify(response_data), 200
    except Exception as e:
        logging.error(f"Search failed for query: {initial_query}, Error: {e}")
        return jsonify({"error": "Search failed due to an internal error"}), 500

#########
# This function 
#########
@app.route('/api/refine_search_space', methods=['POST'])
def refine_search_space():
    thread_id = request.get_json().get('thread_id')

    # Validate thread_id and query presence
    if not thread_id or thread_id not in chat_history:
        return jsonify({"success": False, "error": "Invalid or missing thread_id"}), 400
    
    try:
        # Get the cached results
        cached_results = chat_history.get(thread_id + "_cached_results")
        logging.info(f"📩Current cached results: {cached_results}")

        # Initialize defaults
        refined_results, inferred_semantic_fields, inferred_raw_fields = [], [], []

        # Get user current and previous queries
        cur_query, prev_query = get_user_queries(chat_history, thread_id)
        # Check if the current query mentions semantic / raw metadata fields
        mention_semantic_fields, mention_raw_fields = get_mentioned_fields(chat_history, thread_id)

        # Step 1: Determine action (reset / refine) based on query delta
        inferred_action = infer_action(cur_query=cur_query, prev_query=prev_query)
        logging.info(f"✅Inferred action for current query '{cur_query}' and previous query '{prev_query}': {inferred_action.model_dump()}")

        # Neither reset nor refine: error with LLM inference
        # TODO: implement retry mechanism
        if not inferred_action.reset and not inferred_action.refine:
            logging.error(f"Action inference failed: neither action was identified")
            return jsonify({"error": "Action inference failed"}), 500

        # Step 2.1: If RESET - restore last search results
        if inferred_action.reset:
            # Update the cached results to previous search results
            cached_results = get_last_results(chat_history, thread_id)
            chat_history[thread_id + "_cached_results"] = cached_results
            return jsonify({"success": True, "message": "Successfully reset to last results set"}), 200
        
        # Step 2.2: If REFINE
        # Step 3.1: Handle mentioned SEMANTIC metadata fields in user current query
        if mention_semantic_fields:
            # Identify mentioned semantic metadata fields
            inferred_semantic_fields = infer_mentioned_metadata_fields(cur_query=cur_query, semantic_metadata=True).get_true_fields()
            logging.info(f"✅Inferred mentioned semantic metadata fields for current query '{cur_query}': {inferred_semantic_fields}")

            # TODO: Filter semantic refined results based on cosine similarity scores for better precision?
            refined_results = handle_semantic_fields(chat_history, thread_id, search_space=cached_results)
            append_system_response(chat_history, thread_id, refined_results, refine_type="semantic")

        # Step 3.2: Handle mentioned RAW metadata fields in user current query
        if mention_raw_fields:
            # Identify mentioned raw metadata fields
            inferred_raw_fields = infer_mentioned_metadata_fields(cur_query=cur_query, semantic_metadata=False).get_true_fields()
            logging.info(f"✅Inferred mentioned raw metadata fields for current query '{cur_query}': {inferred_raw_fields}")
            
            sql_clauses, refined_results = handle_raw_fields(cur_query, inferred_raw_fields, search_space=cached_results)
            append_system_response(chat_history, thread_id, refined_results, refine_type="raw")

        # logging.info(f"💬Current chat history: {chat_history}")

        # Package the response with additional information from the second message onwards
        response_data = {
            "top_results": refined_results[:10],
            "complete_results": refined_results,
            "inferred_action": inferred_action.get_true_fields(),
            "mention_semantic_fields": inferred_semantic_fields,
            "mention_raw_fields": inferred_raw_fields,   
            "filter_prompts" : sql_clauses,         
        }

        return jsonify(response_data), 200
        
    except Exception as e:
        logging.error(f"Search refinement failed, Error: {e}")
        return jsonify({"error": "Search refinement failed due to an internal error"}), 500

@app.route('/api/reset_search_space', methods=['POST'])
def reset_search_space():
    thread_id = request.get_json().get('thread_id')
    results = request.json.get('results')

    # Validate thread_id and results presence
    if not thread_id or thread_id not in chat_history:
        return jsonify({"success": False, "error": "Invalid or missing thread_id"}), 400

    if not results:
        return jsonify({"success": False, "error": "No results provided"}), 400

    try:
        # Update the cached results
        chat_history[thread_id + "_cached_results"] = [result["table_name"] for result in results]
        logging.info(f"💬Current chat history: {chat_history}")
        return jsonify({"success": True}), 200
    except Exception as e:
        logging.error(f"Search space reset failed for thread_id '{thread_id}', Error: {e}")
        return jsonify({"error": "Search space reset failed due to an internal error"}), 500

#########
# This function takes in a prompt and prunes it of unnecessary words, keeping only relevant content.
#########
@app.route('/api/prune_prompt', methods=['POST'])
def prune_prompt():
    query = request.get_json().get('query')
    if query and len(query) >= 1: 
        prompt = prune_query(query)
        logging.info(f"✅Prune successful for query: {query}")
        return jsonify({"pruned_query": prompt})
    


#########
# This section is for autogen conversation in chatbot area.
#########  
class MyConversableAgent(ConversableAgent):
    async def a_get_human_input(self, prompt: str) -> str:
        logging.info("async human input")

        start_time = time.time()
        global chat_status
        chat_status="inputting"
        while True:
            if not user_queue.empty():
                logging.info("checking user_queue")
                input_value = user_queue.get()
                chat_status = "chat ongoing"
                return input_value
            if time.time() - start_time > 600: #10 min timeout mechanism for memory leaks
                chat_status = "ended"
                return "exit"
            await asyncio.sleep(1)

async def print_messages(recipient, messages, sender, config):
    print(f"Messages from: {sender.name} sent to {recipient.name} | num messages: {len(messages)} | message: {messages[-1]}")
    content = messages[-1]['content']
    print(messages[-1])

    if all(key in messages[-1] for key in ['name']):
        print_queue.put({'user': messages[-1]['name'], 'message': content}) #ensures 'name' key exists
    elif messages[-1]['role'] == 'user':
        print_queue.put({'user': sender.name, 'message': content})
    else:
        print_queue.put({'user': recipient.name, 'message': content})
    
    return False, None #conversation continued

def create_userproxy():
    user_proxy = MyConversableAgent(
        name = "user_proxy",
        system_message="A human admin.",
        human_input_mode="ALWAYS",
        llm_config=llm_config
        )
    user_proxy.register_reply(
        [autogen.Agent, None],
        reply_func=print_messages,
        config={"callback":None}
    )
    return user_proxy

async def initiate_chat(agent, recipient, message, max_turns):
    logging.info("initiating chat between recipient and user")
    result = await agent.a_initiate_chat(recipient, message=message, summary_method="reflection_with_llm", max_turns=max_turns, clear_history = False)
    return result

def run_chat(thread_id, user_query, task, filters):
    global chat_status
    logging.info("run_chat running.")
    try: 
        with app.app_context():
            #data structure for the req
            user = create_userproxy()
            global task_query
            logging.info("TAKS QUERY: " + task_query)
            # initial_results = hyse_search(user_query, search_space=None)

            # query_refiner = AssistantAgent(name="query_refiner", 
            # system_message="""
            # You are a helpful assistant that refines search queries to make them specific. Users are currently exploring datasets and may not have a clear objective for the dataset in mind, so they require assistance in refining their intent. Ask a single, directed question to help the user clarify their search in one step, aiming to make the query specific enough to elicit their search intent. To be 'specific,' a query should include a topic and a clear task.

            # For example, 'I want a dataset on presidential elections' is too broad. In this case, you should ask a question that helps clarify the task or narrow the scope in just one step.

            # An example of a query that is specific enough would be, 'I want a dataset to train a predictive model on voter turnout in presidential elections.' This query has a clear topic (presidential elections) and a defined task (training a predictive model on voter turnout).

            # After asking the question and receiving the user's response, provide an example of the refined query based on their input: 'An example of the refined query based on your input is: [refined query].' Additionally, offer 3 alternative queries by stating 'Alternative queries:' followed by concise examples to help guide them towards a more specific query. Otherwise, if the search query is specific enough (having both a topic and a clear task), inform the user that they can now proceed to query metadata attributes.
            # """,
            # llm_config=llm_config
            # )
            metadata_agent = AssistantAgent(name="metadata_agent", 
            system_message=f"""     
            You are a helpful assistant that will help reduce the search space given the user query: {task_query}. Given all the metadata attributes and their type: {table_schema_dict}, propose the top 3 metadata attributes from the provided list that will be useful to query over for the given user query. The metadata attributes should be about structure of the dataset, such as number of columns or time granularity, and not for task semantics, such as tags and description. 
            """,
            llm_config=llm_config
            )
            # Define Graph Agent
            #            You are a helpful AI assistant and have access to a Plotly to execute Python code and generate an interactive graph.
                # Refer to {table_schema_dict} to match the user input column to actual column name and determine whether it is a numerical or categorical type. For example, "INT" would be considered numerical and "TEXT" would be considered categorical. Determine one metadata atrribute from the schema that will be useful to query over for the user query: {task_query}. The metadata attributes should be about structure of the dataset, such as number of columns or time granularity, and not for task semantics, such as tags and description. You will suggest the correct column name for the `generate_histogram` function on based on the user input. 
            
            # metadata_agent = AssistantAgent(name="metadata_agent", 
            #     system_message=f"""
            #     You are a helpful agent that will suggest {numbers} as a parameter for the function `generate_histogram.`    
            #     """,
            #     llm_config=llm_config,
            # )


            # Register the function with the correct dataset
            # metadata_agent.register_for_llm(name="generate_histogram", description="Generate a histogram graph for data visualization.")(generate_histogram)
            # user.register_for_execution(name="generate_histogram")(lambda data: generate_histogram(data))

            # graph_agent.register_for_llm(name="generate_histogram", description="Returns histogram based on the numerical column specified.")(generate_histogram)
            # user.register_for_execution(name="generate_histogram")(lambda col_name: generate_histogram(col_name))
            
            # metadata_agent.register_reply(
            #     [UserProxyAgent, None],
            #     reply_func=print_messages,
            #     config={"callback": None}
            # )
            # query_refiner.register_reply(
            #     [UserProxyAgent, None],
            #     reply_func=print_messages,
            #     config={"callback": None}
            # )
            metadata_agent.register_reply(
                [UserProxyAgent, None],
                reply_func=print_messages,
                config={"callback": None}
            )
        
            # asyncio.run(initiate_chat(user, query_refiner, user_query, 4))
            # print("FINISHED RUNNNING INITIATE CHAT")
            metadata_message= f"Please use the new refined query from the summary to generate metadata attribute suggestions from {table_schema_dict} given the task query: {task_query}."
            asyncio.run(initiate_chat(user, metadata_agent, metadata_message, 4))
            # print("FINISHED RUNNNING METADATA CHAT")
            # graph_message = "Suggest the parameter needed to generate a histogram."
            # asyncio.run(initiate_chat(user, metadata_agent, graph_message, 4))
            # print("FINISHED RUNNNING GRAPH CHAT")
            chat_status="ended"
    
    except Exception as e:
        logging.error(f"runchat failed, Error: {e}")
        with app.app_context():
            return jsonify({"error": "Search failed due to an internal error"}), 500

def generate_histogram_spec(attribute, datasets):
    """Generate a Vega-Lite histogram specification."""
    # Extract data for the histogram
    logging.info("GENERATING HISTOGRAM", attribute)
    data = [dataset[attribute] for dataset in datasets if attribute in dataset]
    logging.info(data)
    result = []
    for entry in data:
        logging.info(entry)
        if isinstance(entry, list):  # If the entry is already a list
            for sub_entry in entry:
                result.extend({attribute: value} for value in sub_entry.split(", "))  # Split and append
        elif isinstance(entry, str):  # If the entry is a string
            result.extend({attribute: value} for value in entry.split(", "))  # Split and append
        elif entry is None:
            continue
        else:
            raise ValueError(f"Unexpected type for entry: {type(entry)}. Expected string or list.")

    # Output the result
    print(result)
        



    user_proxy = UserProxyAgent(
    name = "user_proxy",
    system_message="A human admin.",
    human_input_mode="ALWAYS",
    llm_config=llm_config
    )

    veta_agent = AssistantAgent(name="veta_agent", 
    system_message=f"""
          You are a helpful assistant that will generate a Vega-Lite histogram specification with hover tooltips. You have access to the vega lite package and make any necessary downloads needed. Based on the data: {data} of the attribute {attribute}, generate a vega-lite visualization. 

          If the attribute is a numerical type, you should generate a histogram with appropriate bins to summarize the numbers. If the attribute is categorical type, you should group each unique categories together and graph the counts per category. 
          
          For values that are null, replace it with the string "None". Make sure to store each value in data.value as a dictionary. If there are multiple values separated by commas inside of each item in data.value, you should separate the values and group them with all other same values across the data.value. 
          
          Should use "https://vega.github.io/schema/vega-lite/v5.json" for the "$schema". Return only the Vega-Lite specification in the dictionary format.
    """,
    llm_config=llm_config
    )

    try:
        logging.info("initiating metadata agent chat")
        veta_message= "Generate an appropriate Vega-Lite histogram depending on the metadata attribute's type."
        chat_result = user_proxy.initiate_chat(veta_agent, message=veta_message, summary_method="reflection_with_llm", max_turns=1)
        print(chat_result)
        result = re.search(r"{(.*)}", chat_result.chat_history[1]["content"], re.DOTALL)
        print("VEGA", result)
        if result:
            extracted = "{" + result.group(1) + "}"
    
        return extracted
    
    except Exception as e:
        logging.error(f"Starting autogen refinement failed, Error: {e}")
        return jsonify({"error": "Search failed due to an internal error"}), 500  
     

@app.route('/api/suggest_and_generate', methods=['POST'])
def suggest_and_generate():
    """Endpoint to suggest an attribute and generate a histogram."""
    attribute = request.get_json().get('attribute')
    logging.info(attribute)
    # Step 1: Suggest attribute using LLM
    suggested_attribute = attribute
    datasets = get_datasets()

    # Step 2: Generate Vega-Lite spec for the suggested attribute
    try:
        vega_lite_spec = generate_histogram_spec(suggested_attribute, datasets)

    except KeyError:
        return jsonify({"error": f"Attribute '{suggested_attribute}' not found in datasets."}), 400

    return jsonify({"attribute": suggested_attribute, "vegaLiteSpec": vega_lite_spec})

@app.route('/api/suggest_metadata', methods=['POST'])
def suggest_metadata():
    logging.info("Starting metadata chat.")
    thread_id = request.get_json().get('thread_id')
    user_query = request.json.get('query')
    task = request.json.get('task')
    filters = request.json.get('filters')
    
    user_proxy = UserProxyAgent(
        name = "user_proxy",
        system_message="A human admin.",
        human_input_mode="ALWAYS",
        llm_config=llm_config
    )

    metadata_agent = AssistantAgent(name="metadata_agent", 
    system_message=f"""
          You are a helpful assistant that will help reduce the search space given the user query: {task}. The current filters used are {filters}. Given all the metadata attributes and their type: {table_schema_dict}, propose the top 3 metadata attributes from the provided list that will be useful to query over for the given user query. Do not repeat if the filter is already being used. The metadata attributes should be helpful in refining the user's task query and be about structure of the dataset, such as number of columns or time granularity, and not for task semantics, such as tags and description. Your suggestion should be specific to the user query and how the proposed metadata attribute will help the user refine their search. 
          
          For example, if the task was "I want a dataset for elections" then a possible metadata attribute that could be suggested would be 'col_num' with the reason: "can use col_num to identify more complex election datasets with multiple attributes, such as detailed candidate data, geographic breakdowns, or time-based trends, for deeper analysis."
          
          Return your suggestions in a only one dictionary with only "key"=metadata attribute and 'value'=reason why we should use this attribute.
    """,
    llm_config=llm_config
    )
    try:
        logging.info("initiating metadata agent chat")
        chat_result = user_proxy.initiate_chat(metadata_agent, message=user_query, summary_method="reflection_with_llm", max_turns=1)
        result = re.search(r"{(.*)}", chat_result.chat_history[1]["content"], re.DOTALL)
        print(result)
        if result:
            extracted = "{" + result.group(1) + "}"

        
        return jsonify({"metadata_suggestions": extracted, "status": chat_status}), 200
    
    except Exception as e:
        logging.error(f"Starting autogen refinement failed, Error: {e}")
        return jsonify({"error": "Search failed due to an internal error"}), 500  

#########
# This function will return the most suitable agent to call next based on current state of query, task, and filters.
#########
@app.route('/api/start_autogen_chat', methods=['POST'])
def start_autogen_chat():
    logging.info("Starting autogen chat.")
    thread_id = request.get_json().get('thread_id')
    user_query = request.json.get('query')
    task = request.json.get('task')
    filters = request.json.get('filters')

    try:
        global chat_status
        global task_query
        if chat_status == 'error':
            chat_status = 'ended'
        with print_queue.mutex:
            print_queue.queue.clear()
        with user_queue.mutex:
            user_queue.queue.clear()
        
        chat_status = 'chat ongoing'
        logging.info("starting thread")
        
        # Start the thread and pass the request data
        thread = threading.Thread(target=run_chat, args=(thread_id, user_query, task, filters))
        thread.start()
        return jsonify({"status": chat_status}), 200
    
    except Exception as e:
        logging.error(f"Starting autogen chat failed, Error: {e}")
        return jsonify({"error": "Search failed due to an internal error"}), 500  
    

@app.route('/api/start_refinement', methods=['POST'])
def start_refinement():
    logging.info("Choosing autogen agent.")
    thread_id = request.get_json().get('thread_id')
    user_query = request.json.get('query')
    task = request.json.get('task')
    filters = request.json.get('filters')

    user_proxy = UserProxyAgent(
        name = "user_proxy",
        system_message="A human admin.",
        human_input_mode="ALWAYS",
        llm_config=llm_config
    )

    query_refiner = AssistantAgent(name="query_refiner", 
    system_message=f"""
        You are a helpful assistant that refines search queries to make them specific. Users are currently exploring datasets and may not have a clear objective for the dataset in mind, so they require assistance in refining their intent. To be 'specific,' a query should include a topic and a clear task.

        For example, 'I want a dataset on presidential elections' is too broad. Instead, an example of a query that is specific enough would be, 'I want a dataset to train a predictive model on voter turnout in presidential elections.' This query has a clear topic (presidential elections) and a defined task (training a predictive model on voter turnout).

        Offer 3 alternative queries by stating 'Alternative queries:' followed by concise examples to help guide them towards a more specific query.  
    """,
    llm_config=llm_config
    )
    try:
        logging.info("initiating autogen agent chat")
        chat_result = user_proxy.initiate_chat(query_refiner, message=user_query, summary_method="reflection_with_llm", max_turns=1)
        logging.info("finished chat_result")

        pattern = r'\d\.\s(.*)'
        results = re.findall(pattern, chat_result.chat_history[1]["content"])

        return jsonify({"query_suggestions": results, "status": chat_status}), 200
    
    except Exception as e:
        logging.error(f"Starting autogen refinement failed, Error: {e}")
        return jsonify({"error": "Search failed due to an internal error"}), 500  
    

      
#########
# This function takes front end message and puts it in queue for agents.
#########
@app.route('/api/send_message', methods=['POST'])
def send_message():
    logging.info("received user input from frontend")
    user_input = request.json.get('query')
    user_queue.put(user_input)
    return jsonify({'status': 'Message Received'})

#########
# This function displays messages from agents to frontend.
#########
@app.route('/api/get_message', methods=['GET'])
def get_messages():
    global chat_status
    if not print_queue.empty():
        msg = print_queue.get()
        logging.info(msg)
        return jsonify({'message': msg, 'status': chat_status}), 200 
    else:
        return jsonify({'message': '', 'status': chat_status}), 200
    
#########
# This function updates the task query.
#########
@app.route('/api/get_task', methods=['POST'])
def get_task():
    global task_query
    logging.info("received updated task from frontend")
    user_input = request.json.get('query')
    task_query = user_input
    logging.info(task_query)
    return jsonify({'status': 'Message Received'})

#########
# This function updates the metadata attriutes.
#########
@app.route('/api/get_metadata_filters', methods=['GET'])
def get_metadata_filters():
    global metadata_filters
    if not print_queue.empty():
        msg = print_queue.get()
        logging.info(msg)
        return jsonify({'message': msg, 'status': chat_status}), 200 
    else:
        return jsonify({'message': '', 'status': chat_status}), 200

if __name__ == '__main__':
    app.run(debug=True)

