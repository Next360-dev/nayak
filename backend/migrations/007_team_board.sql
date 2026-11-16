-- =============================================================================
-- 007: Team board (tasks + notes) and staff-edited morning briefing.
-- Safe to run more than once.
-- A "team" = one MLA/minister + the staff whose users.mla_username is that leader.
-- The database itself refuses anyone outside the team (defence in depth, like 004 for shares).
-- =============================================================================
CREATE TABLE IF NOT EXISTS team_tasks (
  id           BIGSERIAL PRIMARY KEY,
  team_leader  TEXT NOT NULL,
  title        TEXT NOT NULL,
  note         TEXT,
  url          TEXT,
  created_by   TEXT NOT NULL,
  assigned_to  TEXT,
  due_date     DATE,
  status       TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_team_tasks_leader ON team_tasks (team_leader, status);

CREATE TABLE IF NOT EXISTS team_task_notes (
  id          BIGSERIAL PRIMARY KEY,
  task_id     BIGINT NOT NULL REFERENCES team_tasks(id) ON DELETE CASCADE,
  author      TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_team_task_notes_task ON team_task_notes (task_id, id);

CREATE TABLE IF NOT EXISTS briefing_edits (
  team_leader  TEXT NOT NULL,
  lang         TEXT NOT NULL,
  for_date     DATE NOT NULL,
  body         TEXT NOT NULL,
  edited_by    TEXT NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_leader, lang, for_date)
);

-- Is `who` the leader itself, or one of the leader's staff?
CREATE OR REPLACE FUNCTION in_team(leader TEXT, who TEXT) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u
    WHERE LOWER(u.username) = LOWER(who)
      AND (LOWER(u.username) = LOWER(leader) AND u.role IN ('mla', 'minister')
           OR u.role = 'staff' AND LOWER(u.mla_username) = LOWER(leader))
  );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION enforce_task_team() RETURNS trigger AS $$
BEGIN
  IF NOT in_team(NEW.team_leader, NEW.team_leader) THEN
    RAISE EXCEPTION 'task team leader % is not an MLA or minister', NEW.team_leader USING ERRCODE = 'check_violation';
  END IF;
  IF NOT in_team(NEW.team_leader, NEW.created_by) THEN
    RAISE EXCEPTION 'task creator % is not in the team of %', NEW.created_by, NEW.team_leader USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.assigned_to IS NOT NULL AND NOT in_team(NEW.team_leader, NEW.assigned_to) THEN
    RAISE EXCEPTION 'assignee % is not in the team of %', NEW.assigned_to, NEW.team_leader USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_task_team ON team_tasks;
CREATE TRIGGER trg_enforce_task_team
  BEFORE INSERT OR UPDATE ON team_tasks
  FOR EACH ROW EXECUTE FUNCTION enforce_task_team();

CREATE OR REPLACE FUNCTION enforce_task_note_team() RETURNS trigger AS $$
DECLARE lead TEXT;
BEGIN
  SELECT team_leader INTO lead FROM team_tasks WHERE id = NEW.task_id;
  IF NOT in_team(lead, NEW.author) THEN
    RAISE EXCEPTION 'note author % is not in the team of %', NEW.author, lead USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_task_note_team ON team_task_notes;
CREATE TRIGGER trg_enforce_task_note_team
  BEFORE INSERT ON team_task_notes
  FOR EACH ROW EXECUTE FUNCTION enforce_task_note_team();

CREATE OR REPLACE FUNCTION enforce_briefing_edit_team() RETURNS trigger AS $$
BEGIN
  IF NOT in_team(NEW.team_leader, NEW.team_leader) OR NOT in_team(NEW.team_leader, NEW.edited_by) THEN
    RAISE EXCEPTION 'briefing edit by % is not allowed for %', NEW.edited_by, NEW.team_leader USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_briefing_edit_team ON briefing_edits;
CREATE TRIGGER trg_enforce_briefing_edit_team
  BEFORE INSERT OR UPDATE ON briefing_edits
  FOR EACH ROW EXECUTE FUNCTION enforce_briefing_edit_team();
