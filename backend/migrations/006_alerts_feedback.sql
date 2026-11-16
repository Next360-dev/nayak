-- =============================================================================
-- 006: contact details + alert preferences, send-once log, story feedback, app feedback.
-- Safe to run more than once.
-- =============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lang TEXT NOT NULL DEFAULT 'en';

-- Every message the system tried to send. The unique index makes "send once" safe even across restarts.
CREATE TABLE IF NOT EXISTS notification_log (
    id         BIGSERIAL PRIMARY KEY,
    at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    kind       TEXT NOT NULL,
    key        TEXT NOT NULL,
    recipient  TEXT NOT NULL,
    channel    TEXT NOT NULL DEFAULT 'email',
    ok         BOOLEAN NOT NULL,
    error      TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_once ON notification_log (kind, key, recipient) WHERE ok;

-- "This story is not relevant / its priority or tone is wrong" from the people who read the news.
CREATE TABLE IF NOT EXISTS story_feedback (
    id          BIGSERIAL PRIMARY KEY,
    at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    article_id  BIGINT,
    title       TEXT,
    kind        TEXT NOT NULL CHECK (kind IN ('not_relevant', 'wrong_priority', 'wrong_sentiment')),
    note        TEXT,
    username    TEXT NOT NULL,
    UNIQUE (article_id, kind, username)
);
CREATE INDEX IF NOT EXISTS idx_story_feedback_at ON story_feedback (at DESC);

-- Free-text feedback about the app itself (used during the pilot).
CREATE TABLE IF NOT EXISTS app_feedback (
    id        BIGSERIAL PRIMARY KEY,
    at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    username  TEXT NOT NULL,
    message   TEXT NOT NULL
);
