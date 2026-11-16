-- ============================================================
-- SQL Queries for Gemini AI Vector Caching in PostgreSQL
-- Visible and manageable in pgAdmin under ai_smart_office database
-- ============================================================

-- name: create_table_gemini_embeddings_cache
CREATE TABLE IF NOT EXISTS gemini_embeddings_cache (
    text_hash VARCHAR(64) PRIMARY KEY,
    snippet TEXT NOT NULL,
    vector_json TEXT NOT NULL,
    model_name VARCHAR(64) DEFAULT 'gemini-embedding-001',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- name: fetch_cached_embedding
SELECT vector_json FROM gemini_embeddings_cache WHERE text_hash = %s;

-- name: upsert_cached_embedding
INSERT INTO gemini_embeddings_cache (text_hash, snippet, vector_json, model_name, created_at)
VALUES (%s, %s, %s, %s, NOW())
ON CONFLICT (text_hash) DO UPDATE
SET vector_json = EXCLUDED.vector_json,
    model_name = EXCLUDED.model_name,
    created_at = NOW();
