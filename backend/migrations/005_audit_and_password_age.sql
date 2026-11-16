-- =============================================================================
-- 005: audit log + password age. Safe to run more than once.
--   users.password_changed_at : a login token issued BEFORE this moment is rejected
--   audit_log                 : who did what, when (also drives the login lockout)
-- =============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS audit_log (
    id      BIGSERIAL PRIMARY KEY,
    at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor   TEXT,
    action  TEXT        NOT NULL,
    target  TEXT,
    detail  JSONB       NOT NULL DEFAULT '{}'::jsonb,
    ip      TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log (at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action_at ON audit_log (action, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_login ON audit_log (target, ip, at DESC) WHERE action IN ('login_failed', 'login_ok');
