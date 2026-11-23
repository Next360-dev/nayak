-- =============================================================================
-- 011: Saved stories (a private reading list per user).
-- Safe to run more than once.
-- =============================================================================
CREATE TABLE IF NOT EXISTS saved_stories (
    id          SERIAL PRIMARY KEY,
    username    TEXT        NOT NULL,
    story_key   TEXT        NOT NULL,      -- "a:<article_id>" or "u:<url>"
    article_id  BIGINT,
    title       TEXT        NOT NULL,
    url         TEXT,
    summary     TEXT,
    place       TEXT,
    source      TEXT,
    tone        TEXT,
    published_at TIMESTAMPTZ,
    saved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (username, story_key)
);
CREATE INDEX IF NOT EXISTS idx_saved_stories_user ON saved_stories (username, saved_at DESC);
