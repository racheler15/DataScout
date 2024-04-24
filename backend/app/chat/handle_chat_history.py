import logging

def append_user_query(chat_history, thread_id, text, mention_semantic_fields=None, mention_raw_fields=None):
    # Append user query with additional metadata field information to the chat history
    response = {
        "sender": "user",
        "text": text,
        "mention_semantic_fields": mention_semantic_fields if mention_semantic_fields is not None else False,
        "mention_raw_fields": mention_raw_fields if mention_raw_fields is not None else False
    }

    if thread_id in chat_history:
        chat_history[thread_id].append(response)
    
    logging.info(f"💬User input query added to chat history for thread_id {thread_id}: {text}")

def append_system_response(chat_history, thread_id, text, refine_type):
    # Append a system response to the chat history
    response = {
        "sender": "system",
        "text": text,
        "refine_type": refine_type
    }

    if thread_id in chat_history:
        chat_history[thread_id].append(response)

    logging.info(f"💬System response added to chat history for thread_id {thread_id}: {text}")