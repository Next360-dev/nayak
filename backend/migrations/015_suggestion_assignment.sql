ALTER TABLE leader_suggestions
  ADD COLUMN IF NOT EXISTS assigned_to TEXT REFERENCES users(username) ON DELETE SET NULL;
