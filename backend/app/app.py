from flask import Flask, request, jsonify
from flask_cors import CORS
from uuid import uuid4
import logging
from backend.app.table_representation.openai_client import OpenAIClient
from backend.app.hyse.hypo_schema_search import hyse_search, most_popular_datasets
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



# Flask app configuration
app = Flask(__name__)
CORS(app)

chat_status = "ended"

# Queues for single-user setup
print_queue = queue.Queue()
user_queue = queue.Queue()

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

# Overwrite print_received_messages from Autogen libraries, currently hardcoded; need to stream
# def new_print_received_message(self, message, sender):
#     print(f"PATCHED {sender.name}: {message}")
#     socket_io.emit('message', {"sender": sender.name, "content": message})
# AssistantAgent._print_received_message = new_print_received_message
# UserProxyAgent._print_received_message = new_print_received_message


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
    global chat_status
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
            if time.time()-start_time > 600: #10 min timeout mechanism for memory leaks
                chat_status = "ended"
                return "exit"
            await asyncio.sleep(1)

async def print_messages(recipient, messages, sender, config):
    print(f"Messages from: {sender.name} sent to {recipient.name} | num messages: {len(messages)} | message: {messages[-1]}")
    content = messages[-1]['content']
    print(content)

    if all(key in messages[-1] for key in ['name']):
        print_queue.put({'user': messages[-1]['name'], 'message': content})
    elif messages[-1]['role'] == 'user':
        print_queue.put({'user': sender.name, 'message': content})
    else:
        print_queue.put({'user': recipient.name, 'message': content})
    
    return False, None

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
    if result is None:
        logging.error("No result returned from initiate_chat")
    print("RESULT", result)
    return result

def run_chat(thread_id, user_query, task, filters):
    global chat_status
    logging.info("run_chat running.")
    try: 
        with app.app_context():
            #data structure for the req
            user = create_userproxy()

            query_refiner = AssistantAgent(name="query_refiner", 
            system_message="""
            You are a helpful assistant that refines search queries to make them specific. Users are currently exploring datasets and may not have a clear objective for the dataset in mind, so they require assistance in refining their intent. Ask a single, directed question to help the user clarify their search in one step, aiming to make the query specific enough to elicit their search intent. To be 'specific,' a query should include a topic and a clear task.

            For example, 'I want a dataset on presidential elections' is too broad. In this case, you should ask a question that helps clarify the task or narrow the scope in just one step.

            An example of a query that is specific enough would be, 'I want a dataset to train a predictive model on voter turnout in presidential elections.' This query has a clear topic (presidential elections) and a defined task (training a predictive model on voter turnout).

            After asking the question and receiving the user's response, provide an example of the refined query based on their input: 'An example of the refined query based on your input is: [refined query].' Additionally, offer 3 alternative queries by stating 'Alternative queries:' followed by concise examples to help guide them towards a more specific query. Otherwise, if the search query is specific enough (having both a topic and a clear task), inform the user that they can now proceed to query metadata attributes.
            """,
            llm_config=llm_config
            )
            metadata_agent = AssistantAgent(name="metadata_agent", 
            system_message=f"""     
            You are a helpful assistant that will help reduce the search space given the user query: {user_query}. Given all the metadata attributes and their type: {table_schema_dict}, propose the top 3 metadata attributes from the provided list that will be useful to query over for the given user query.
            """,
            llm_config=llm_config
            )
            metadata_agent.register_reply(
                [UserProxyAgent, None],
                reply_func=print_messages,
                config={"callback": None}
            )
            query_refiner.register_reply(
                [UserProxyAgent, None],
                reply_func=print_messages,
                config={"callback": None}
            )
        
            asyncio.run(initiate_chat(user, query_refiner, user_query, 5))
            print("FINISHED RUNNNING INITIATE CHAT")
            metadata_message= "Please use the new refined query from the summary to generate metadata attribute suggestions."
            asyncio.run(initiate_chat(user, metadata_agent, metadata_message, 2))

            chat_status="ended"
    
    except Exception as e:
        logging.error(f"runchat failed, Error: {e}")
        with app.app_context():
            return jsonify({"error": "Search failed due to an internal error"}), 500
        

@app.route('/api/agent_chooser', methods=['POST'])
def agent_chooser():
    logging.info("Choosing autogen agent.")
    thread_id = request.get_json().get('thread_id')
    user_query = request.json.get('query')
    task = request.json.get('task')
    filters = request.json.get('filters')

    user = UserProxyAgent(
    name = "user_proxy",
    system_message="A human admin.",
    human_input_mode="ALWAYS",
    llm_config=llm_config
    )

    agent_chooser = AssistantAgent(name="agent_chooser", 
    system_message=f"""
    You are a helpful assistant suggests the next agent to call based on the user_query, existing filters, and existing task. You will output only one agent (query_refiner, graph_agent) based on the following logic:
    
    query_refiner: This agent refines search queries to make them specific. 
    - Call this agent if {task} is empty.

    graph_agent: This agent will graph the distribution of the categorical or numerical variable specified in {user_query}. 
    - Call this agent if {task} is not empty, and {user_query} specifies a metadata attribute from {table_schema_dict}.
    """,
    llm_config=llm_config
    )
    try:
        global chat_status
        logging.info("initiating autogen agent chat")
        chat_result = user.initiate_chat(agent_chooser, message=user_query, summary_method="reflection_with_llm",max_turns=1)
        
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
        logging.info(chat_result.chat_history)
        return jsonify({"agent_chosen": chat_result.chat_history[1]["content"], "status": chat_status}), 200
    except Exception as e:
        logging.error(f"Agent chooser failed, Error: {e}")
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



@app.route('/api/query_refiner', methods=['POST'])
def query_refiner():
    logging.info("Query refiner agent.")
    user_query = request.json.get('query')

    user = UserProxyAgent(
    name = "user_proxy",
    system_message="A human admin.",
    human_input_mode="ALWAYS",
    llm_config=llm_config
    )

    query_refiner = AssistantAgent(name="query_refiner", 
    system_message="""
    You are a helpful assistant that refines search queries to make them specific. Users are currently exploring datasets and may not have a clear objective for the dataset in mind, so they require assistance in refining their intent. Ask a single, directed question to help the user clarify their search in one step, aiming to make the query specific enough to elicit their search intent. To be 'specific,' a query should include a topic and a clear task.

    For example, 'I want a dataset on presidential elections' is too broad. In this case, you should ask a question that helps clarify the task or narrow the scope in just one step.

    An example of a query that is specific enough would be, 'I want a dataset to train a predictive model on voter turnout in presidential elections.' This query has a clear topic (presidential elections) and a defined task (training a predictive model on voter turnout).

    After asking the question and receiving the user's response, provide an example of the refined query based on their input: 'An example of the refined query based on your input is: [refined query].' Additionally, offer 3 alternative queries by stating 'Alternative queries:' followed by concise examples to help guide them towards a more specific query. Otherwise, if the search query is specific enough (having both a topic and a clear task), inform the user that they can now proceed to query metadata attributes.
    """,
    llm_config=llm_config
    )

    chat_result = user.initiate_chat(query_refiner, message=user_query, summary_method="reflection_with_llm", max_turns=4)
    jsonify(chat_result.summary)

    
#########
# This function takes in a initial query and helps refine it. Then it suggests 3 metadata attributes to query over.
#########
@app.route('/api/autogen_reply', methods=['POST'])
def autogen_reply():
    logging.info("Starting or continuing autogen search pipeline")
    thread_id = request.get_json().get('thread_id')
    initial_query = request.json.get('query')
    # Ensure the thread_id exists
    if thread_id not in chat_history:
        return jsonify({'error': 'Thread ID not found'}), 404
    if not initial_query or len(initial_query.strip()) == 0:
        logging.error("Empty query provided")
        return jsonify({"error": "No query provided"}), 400


    # initial_results = hyse_search(initial_query, search_space=None)


    user = UserProxyAgent(
        name = "user_proxy",
        system_message="A human admin.",
        human_input_mode="ALWAYS",
        llm_config=llm_config
    )

    query_refiner = AssistantAgent(name="query_refiner", 
        system_message="""
        You are a helpful assistant that refines search queries to make them specific. Users are currently exploring datasets and may not have a clear objective for the dataset in mind, so they require assistance in refining their intent. Ask a single, directed question to help the user clarify their search in one step, aiming to make the query specific enough to elicit their search intent. To be 'specific,' a query should include a topic and a clear task.

        For example, 'I want a dataset on presidential elections' is too broad. In this case, you should ask a question that helps clarify the task or narrow the scope in just one step.

        An example of a query that is specific enough would be, 'I want a dataset to train a predictive model on voter turnout in presidential elections.' This query has a clear topic (presidential elections) and a defined task (training a predictive model on voter turnout).

        After asking the question and receiving the user's response, provide an example of the refined query based on their input: 'An example of the refined query based on your input is: [refined query].' Additionally, offer 3 alternative queries by stating 'Alternative queries:' followed by concise examples to help guide them towards a more specific query. Otherwise, if the search query is specific enough (having both a topic and a clear task), inform the user that they can now proceed to query metadata attributes.
        """,
        llm_config=llm_config
    )

    metadata_agent = AssistantAgent(name="metadata_agent", 
        system_message=f"""     
        You are a helpful assistant that will help reduce the search space given the user query: {initial_query}. Given all the metadata attributes and their type: {table_schema_dict}, propose the top 3 metadata attributes that will be useful to query over for the given user query.
        """,
        llm_config=llm_config
    )
    try:
        initial_results = hyse_search(initial_query, search_space=None)
        append_system_response(chat_history, thread_id, initial_results, refine_type="semantic")
        
        chat_results = user.initiate_chats(
        [
            {"recipient": query_refiner,
            "message": initial_query,
            "summary_method": "reflection_with_llm",
            "max_turns": 3,
            "silent": False
            },
            {"recipient": metadata_agent,
            "message": "Please use the new refined query from the summary to generate metadata attribute suggestions.",
            "summary_method": "reflection_with_llm",
            "max_turns": 1,
            "silent": False
            },
            ]
        )

        # Update the cached results
        chat_history[thread_id + '_cached_results'] = [result["table_name"] for result in initial_results]

        response_data = {
            "top_results": initial_results[:10],
            "complete_results": initial_results,
            "chat_history": chat_history,
            "chat_results": chat_results
        }

        logging.info(f"✅Search successful for query: {initial_query}")
        logging.info(f"💬 Current chat history: {chat_history}")

        return jsonify(response_data), 200
    except Exception as e:
        logging.error(f"Search failed for query: {initial_query}, Error: {e}")
        return jsonify({"error": "Search failed due to an internal error"}), 500    
    
     

if __name__ == '__main__':
    app.run(debug=True)

