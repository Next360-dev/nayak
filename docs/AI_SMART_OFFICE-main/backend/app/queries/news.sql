-- =============================================================================
-- NEWS & ARTICLES QUERIES
-- Optimized SQL queries for news feed and statewide counts
-- =============================================================================

-- name: check_direct_article_base
SELECT 1 FROM new_articles
WHERE 1=1

-- name: select_articles_base
SELECT
    id,
    title,
    COALESCE(summary, title) AS description,
    COALESCE(district, 'Statewide') AS district,
    COALESCE(constituency, 'Statewide') AS constituency,
    state,
    COALESCE(sources, '[]'::jsonb) AS sources,
    COALESCE(published_at, CURRENT_TIMESTAMP) AS published_at,
    constituencies,
    civic_constituencies,
    COALESCE(sentiment, 'positive') AS sentiment,
    COALESCE(is_statewide, FALSE) AS is_statewide
FROM new_articles
WHERE 1=1

-- name: count_statewide_articles
SELECT COUNT(*) 
FROM new_articles 
WHERE (is_statewide = TRUE OR district = 'Statewide' OR constituency = 'Statewide');

-- name: archive_stale_articles
WITH moved_rows AS (
    DELETE FROM new_articles
    WHERE published_at < NOW() - INTERVAL '60 days'
    RETURNING id, title, district, constituency, constituencies, civic_constituencies, state, summary, sources, published_at, created_at, sentiment, is_statewide
)
INSERT INTO archive_news (
    id, title, district, constituency, constituencies, civic_constituencies, state, summary, sources, published_at, created_at, sentiment, is_statewide, archived_at
)
SELECT 
    id, title, district, constituency, constituencies, civic_constituencies, state, summary, sources, published_at, created_at, sentiment, is_statewide, NOW()
FROM moved_rows
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    sources = EXCLUDED.sources,
    sentiment = EXCLUDED.sentiment,
    archived_at = NOW();

