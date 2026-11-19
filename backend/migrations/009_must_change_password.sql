-- =============================================================================
-- 009: Force a password change on first login after an admin/leader creates or resets an account.
-- Safe to run more than once.
-- =============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
