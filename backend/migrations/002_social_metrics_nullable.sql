-- =============================================================================
-- 002: Social engagement counts can be unknown (NULL) instead of an invented number.
-- Safe to run more than once. Apply with:
--   psql -U <user> -d ai_smart_office -f backend/migrations/002_social_metrics_nullable.sql
-- =============================================================================
ALTER TABLE social_media_posts ALTER COLUMN likes_count    DROP NOT NULL;
ALTER TABLE social_media_posts ALTER COLUMN shares_count   DROP NOT NULL;
ALTER TABLE social_media_posts ALTER COLUMN comments_count DROP NOT NULL;
ALTER TABLE social_media_posts ALTER COLUMN views_count    DROP NOT NULL;
