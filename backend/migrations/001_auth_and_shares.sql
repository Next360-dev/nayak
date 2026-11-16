-- =============================================================================
-- 001: Auth hardening, roles, and admin <-> leader sharing
-- Safe to run more than once. Apply with:
--   psql -U <user> -d ai_smart_office -f backend/migrations/001_auth_and_shares.sql
-- =============================================================================

-- Roles: admin | mla | minister | staff
--   staff users act for one MLA: users.mla_username points at that MLA's username.
ALTER TABLE users ADD COLUMN IF NOT EXISTS mla_username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- One shared item (a snapshot of the article so the link survives archiving).
CREATE TABLE IF NOT EXISTS shares (
    id            SERIAL PRIMARY KEY,
    sender        TEXT        NOT NULL,
    article_id    BIGINT,
    title         TEXT        NOT NULL,
    url           TEXT,
    summary       TEXT,
    district_name TEXT,
    constituency_name TEXT,
    note          TEXT,
    priority      TEXT        NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per recipient, with that recipient's own status.
CREATE TABLE IF NOT EXISTS share_recipients (
    id         SERIAL PRIMARY KEY,
    share_id   INTEGER     NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
    recipient  TEXT        NOT NULL,
    status     TEXT        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'seen', 'acting', 'done')),
    seen_at    TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (share_id, recipient)
);
CREATE INDEX IF NOT EXISTS idx_share_recipients_recipient ON share_recipients (recipient, status);

-- Reply thread per (share, recipient) so one MLA never sees another MLA's replies.
CREATE TABLE IF NOT EXISTS share_replies (
    id         SERIAL PRIMARY KEY,
    share_id   INTEGER     NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
    recipient  TEXT        NOT NULL,
    author     TEXT        NOT NULL,
    body       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_share_replies_thread ON share_replies (share_id, recipient);
