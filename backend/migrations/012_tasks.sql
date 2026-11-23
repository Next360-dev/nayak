-- 012_tasks.sql - Milestone-1 task tables (idempotent)
-- Watchlist: staff pick up to 5 people per office; crawls public posts for them.
CREATE TABLE IF NOT EXISTS watchlist_names (
    id SERIAL PRIMARY KEY,
    leader_username TEXT NOT NULL,
    name TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlist_names_leader_lower_name
    ON watchlist_names (leader_username, LOWER(name));

CREATE TABLE IF NOT EXISTS watchlist_posts (
    id SERIAL PRIMARY KEY,
    watchlist_id INTEGER NOT NULL REFERENCES watchlist_names(id) ON DELETE CASCADE,
    post_id TEXT NOT NULL,
    platform TEXT,
    headline TEXT,
    url TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (watchlist_id, post_id)
);

-- Composed posts: compose + schedule + leader approval + saved drafts.
CREATE TABLE IF NOT EXISTS composed_posts (
    id SERIAL PRIMARY KEY,
    leader_username TEXT NOT NULL,
    owner_username TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    platforms JSONB NOT NULL DEFAULT '[]',
    scheduled_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'draft',
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project tracker: staff post, admin sees. Reuses letters/work-item record pattern.
CREATE TABLE IF NOT EXISTS project_updates (
    id SERIAL PRIMARY KEY,
    leader_username TEXT NOT NULL,
    owner_username TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    milestones JSONB NOT NULL DEFAULT '[]',
    photos JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Public feedback / constituency survey: public form without login.
CREATE TABLE IF NOT EXISTS public_survey_responses (
    id SERIAL PRIMARY KEY,
    ip TEXT,
    role TEXT,
    category TEXT,
    message TEXT NOT NULL,
    name TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_public_survey_ip ON public_survey_responses(ip);

-- Leader inbox suggestions (rules-based from alerts + watchlist).
CREATE TABLE IF NOT EXISTS leader_suggestions (
    id SERIAL PRIMARY KEY,
    leader_username TEXT NOT NULL,
    source TEXT NOT NULL,
    item_id TEXT NOT NULL,
    title TEXT NOT NULL,
    suggestion TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ
);

-- WhatsApp chat paste/upload -> rules-based sorter -> staff + admin inbox.
CREATE TABLE IF NOT EXISTS whatsapp_uploads (
    id SERIAL PRIMARY KEY,
    leader_username TEXT NOT NULL,
    owner_username TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]',
    route_to JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
