-- Portfolio content belongs to a leader's office and is edited by that office's staff.
CREATE TABLE IF NOT EXISTS official_portfolios (
  leader_username TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by TEXT REFERENCES users(username) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
