-- =============================================================================
-- TRANSLATION QUERIES
-- High-speed PostgreSQL persistent cache for Telugu <-> English translations
-- =============================================================================

-- name: create_table_translation_cache
CREATE TABLE IF NOT EXISTS translations_cache (
    id SERIAL PRIMARY KEY,
    source_lang VARCHAR(10) NOT NULL,
    target_lang VARCHAR(10) NOT NULL,
    source_text_hash VARCHAR(64) NOT NULL,
    source_text TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_translation_pair UNIQUE (source_lang, target_lang, source_text_hash)
);
CREATE INDEX IF NOT EXISTS idx_trans_cache_lookup 
ON translations_cache (source_lang, target_lang, source_text_hash);

-- name: fetch_cached_translation
SELECT translated_text 
FROM translations_cache 
WHERE source_lang = %s AND target_lang = %s AND source_text_hash = %s
LIMIT 1;

-- name: upsert_cached_translation
INSERT INTO translations_cache (source_lang, target_lang, source_text_hash, source_text, translated_text)
VALUES (%s, %s, %s, %s, %s)
ON CONFLICT (source_lang, target_lang, source_text_hash) 
DO UPDATE SET translated_text = EXCLUDED.translated_text;
