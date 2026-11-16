-- =============================================================================
-- 008: How a leader is addressed on screen (MLA / MP / Minister) and their party.
-- Safe to run more than once. Staff inherit both from their leader (see queries/users.sql).
-- =============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS leader_title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS leader_party TEXT;
