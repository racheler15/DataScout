from backend.app.hyse.hypo_schema_search import hyse_search
from backend.app.actions.infer_action import text_to_sql, execute_sql, filters_to_sql, execute_metadata_sql
import logging
import ast 
def handle_semantic_fields(chat_history, thread_id, search_space):
    # Run refined hyse again: combine all previous semantic related queries
    # Filter messages where 'mention_semantic_fields' is True
    semantic_queries = [message['text'] for message in chat_history[thread_id] if message.get('mention_semantic_fields')]
    # Concatenate the filtered messages into a single string
    semantic_queries_comb = ' '.join(semantic_queries)
    # Run hyse again
    refined_results = hyse_search(semantic_queries_comb, search_space)

    return refined_results

def handle_raw_fields(cur_query, inferred_raw_fields, search_space):
    # Excute text to sql
    sql_clauses = text_to_sql(cur_query, inferred_raw_fields)
    logging.info(f"✅Inferred SQL clauses for current query '{cur_query}': {sql_clauses.model_dump()}")

    # Parse inferred sql clauses & inject into query template
    for sql_clause in sql_clauses.sql_clauses:
        logging.info(sql_clause.field)
        logging.info(sql_clause.clause)
    
    refined_results = execute_sql(sql_clauses, search_space)

    return sql_clauses.model_dump(), refined_results

def handle_raw_filters(cur_query, filters, search_space):
    sql_clauses = filters_to_sql(cur_query, filters)
    if isinstance(sql_clauses, str):  # Check if sql_clauses is a string
        sql_clauses = ast.literal_eval(sql_clauses)

    logging.info(f"Type of sql_clauses: {type(sql_clauses)}")
    logging.info(f"Content of sql_clauses: {sql_clauses}")
    for sql_clause in sql_clauses:
        logging.info(f"Field: {sql_clause['Field']}")
        logging.info(f"Operator: {sql_clause['Operator']}")
        logging.info(f"Parameter: {sql_clause['Parameter']}")
    
    refined_results = execute_metadata_sql(sql_clauses, search_space)
    return sql_clauses, refined_results

