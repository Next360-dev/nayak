-- =============================================================================
-- 000: Base tables for a FRESH database. Safe to run more than once.
-- Apply BEFORE 001-003:
--   psql -U <user> -d ai_smart_office -f backend/migrations/000_base_schema.sql
-- (translations_cache and gemini_embeddings_cache are created by the app itself.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
  username          TEXT PRIMARY KEY,
  password_hash     TEXT NOT NULL,
  role              TEXT NOT NULL,
  politician_name   TEXT,
  constituency_name TEXT,
  district_name     TEXT,
  last_login        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS political_representatives (
  id                 SERIAL PRIMARY KEY,
  name               TEXT NOT NULL,
  role_type          TEXT,
  party              TEXT,
  district_name      TEXT,
  constituency_name  TEXT,
  mandal_corporation TEXT,
  contact_phone      TEXT,
  email              TEXT,
  UNIQUE (name, constituency_name)
);

CREATE TABLE IF NOT EXISTS new_articles (
  id                   SERIAL PRIMARY KEY,
  title                TEXT NOT NULL,
  district             VARCHAR(100) NOT NULL,
  constituency         VARCHAR(100) DEFAULT 'Statewide',
  constituencies       TEXT[] DEFAULT '{}',
  civic_constituencies TEXT[] DEFAULT '{}',
  state                VARCHAR(100) NOT NULL DEFAULT 'Telangana',
  summary              TEXT,
  sources              JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_at         TIMESTAMPTZ DEFAULT now(),
  created_at           TIMESTAMPTZ DEFAULT now(),
  sentiment            VARCHAR(20) DEFAULT 'positive',
  is_statewide         BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_new_articles_sentiment ON new_articles(sentiment);
CREATE INDEX IF NOT EXISTS idx_new_articles_statewide ON new_articles(is_statewide);

CREATE TABLE IF NOT EXISTS social_media_posts (
  id              SERIAL PRIMARY KEY,
  platform        TEXT, post_id TEXT, mla_name TEXT, constituency TEXT, district TEXT,
  author_handle   TEXT, author_name TEXT, content TEXT, url TEXT, media_url TEXT,
  likes_count     INT, shares_count INT, comments_count INT, views_count INT,
  sentiment       TEXT, sentiment_reason TEXT,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (platform, url)
);

-- (the old `tasks` table was removed from fresh installs: nothing used it. Existing databases keep their empty copy.)
