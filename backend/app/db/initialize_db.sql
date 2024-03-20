-- Enable the `pgvector` extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS corpus_raw_metadata_with_embedding (
    table_name TEXT PRIMARY KEY,
    col_num INT,
    popularity INT,
    time_granu TEXT,
    geo_granu TEXT,
    comb_embed VECTOR(1536),
    query_embed VECTOR(1536)
);

-- Add index for the embeddings using HNSW cosine distance
-- Note: Vectors with up to 2,000 dimensions can be indexed
CREATE INDEX IF NOT EXISTS comb_embed_idx ON corpus_raw_metadata_with_embedding USING hnsw (comb_embed vector_cosine_ops);
CREATE INDEX IF NOT EXISTS query_embed_idx ON corpus_raw_metadata_with_embedding USING hnsw (query_embed vector_cosine_ops);