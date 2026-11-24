-- 016: every public survey response belongs to ONE leader, so an office only ever sees its own responses.
-- Rows from before this migration have no owner and are visible to nobody (they cannot be attributed safely).
ALTER TABLE public_survey_responses ADD COLUMN IF NOT EXISTS leader_username TEXT;
CREATE INDEX IF NOT EXISTS idx_public_survey_leader ON public_survey_responses (leader_username, created_at DESC);
