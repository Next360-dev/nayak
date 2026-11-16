-- =============================================================================
-- 003: Mobile refresh tokens and device (push) tokens.
-- Safe to run more than once.
-- =============================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id            SERIAL PRIMARY KEY,
    username      TEXT        NOT NULL,
    token_hash    TEXT        NOT NULL UNIQUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at    TIMESTAMPTZ NOT NULL,
    revoked_at    TIMESTAMPTZ,
    replaced_by   TEXT
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_username ON refresh_tokens (username);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens (token_hash);

CREATE TABLE IF NOT EXISTS device_tokens (
    id            SERIAL PRIMARY KEY,
    username      TEXT        NOT NULL,
    token         TEXT        NOT NULL UNIQUE,
    platform      TEXT        NOT NULL DEFAULT 'unknown',
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_username ON device_tokens (username);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens (token);
