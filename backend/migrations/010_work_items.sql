-- =============================================================================
-- 010: Work items (letters & petitions) with approval workflow.
-- Safe to run more than once.
-- A team = one MLA/minister + the staff whose users.mla_username is that leader
-- (the in_team() function from migration 007).
-- =============================================================================

CREATE TABLE IF NOT EXISTS work_items (
  id            BIGSERIAL PRIMARY KEY,
  team_leader   TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('letter','petition')),
  direction     TEXT NOT NULL CHECK (direction IN ('incoming','outgoing')),
  title         TEXT NOT NULL CHECK (length(title) <= 200),
  body          TEXT,
  reference_no  TEXT,
  counterpart   TEXT,
  priority      TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','urgent')),
  due_date      DATE,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','changes_requested','approved','rejected','closed')),
  created_by    TEXT NOT NULL,
  assignee      TEXT,
  decided_by    TEXT,
  decided_at    TIMESTAMPTZ,
  decision_note TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_work_items_leader_status ON work_items (team_leader, status);

CREATE TABLE IF NOT EXISTS work_item_events (
  id         BIGSERIAL PRIMARY KEY,
  item_id    BIGINT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  actor      TEXT NOT NULL,
  action     TEXT NOT NULL CHECK (action IN ('created','edited','submitted','approved','rejected','changes_requested','commented','assigned','closed')),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Is `who` the leader itself, or one of the leader's staff? (from migration 007; reused here)
CREATE OR REPLACE FUNCTION enforce_work_item_rules() RETURNS trigger AS $$
DECLARE
  legal BOOLEAN := FALSE;
  dec_role TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT in_team(NEW.team_leader, NEW.created_by) THEN
      RAISE EXCEPTION 'creator % is not in the team of %', NEW.created_by, NEW.team_leader USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.assignee IS NOT NULL AND NOT in_team(NEW.team_leader, NEW.assignee) THEN
      RAISE EXCEPTION 'assignee % is not in the team of %', NEW.assignee, NEW.team_leader USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'new work item must start in draft status, got %', NEW.status USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL THEN
      RAISE EXCEPTION 'decided_by/decided_at must be null on creation' USING ERRCODE = 'check_violation';
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE'
  NEW.updated_at := NOW();

  CASE
    WHEN OLD.status = 'draft'                     AND NEW.status = 'submitted'                                    THEN legal := TRUE;
    WHEN OLD.status = 'submitted'                 AND NEW.status IN ('approved','rejected','changes_requested')   THEN legal := TRUE;
    WHEN OLD.status = 'changes_requested'         AND NEW.status = 'submitted'                                    THEN legal := TRUE;
    WHEN OLD.status = 'approved'                  AND NEW.status = 'closed'                                       THEN legal := TRUE;
    WHEN OLD.status = 'rejected'                  AND NEW.status = 'closed'                                       THEN legal := TRUE;
    WHEN OLD.status = NEW.status                                                THEN legal := TRUE;
    ELSE                                                                                                         legal := FALSE;
  END CASE;

  IF NOT legal THEN
    RAISE EXCEPTION 'illegal status transition % -> %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.assignee IS NOT NULL AND NOT in_team(NEW.team_leader, NEW.assignee) THEN
    RAISE EXCEPTION 'assignee % is not in the team of %', NEW.assignee, NEW.team_leader USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status IN ('approved','rejected','changes_requested') THEN
    IF NEW.decided_by IS NULL THEN
      RAISE EXCEPTION 'decided_by is required for %', NEW.status USING ERRCODE = 'check_violation';
    END IF;
    SELECT role INTO dec_role FROM users WHERE LOWER(username) = LOWER(NEW.decided_by);
    IF dec_role IS NULL OR dec_role NOT IN ('mla','minister') OR LOWER(NEW.decided_by) <> LOWER(NEW.team_leader) THEN
      RAISE EXCEPTION 'only the team leader can decide: %', NEW.decided_by USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.decided_at IS NULL THEN
      NEW.decided_at := NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_work_item_rules ON work_items;
CREATE TRIGGER trg_enforce_work_item_rules
  BEFORE INSERT OR UPDATE ON work_items
  FOR EACH ROW EXECUTE FUNCTION enforce_work_item_rules();

CREATE OR REPLACE FUNCTION enforce_event_append_only() RETURNS trigger AS $$
DECLARE
  lead TEXT;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    RAISE EXCEPTION 'work_item_events is append-only' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT team_leader INTO lead FROM work_items WHERE id = NEW.item_id;
    IF lead IS NULL THEN
      RAISE EXCEPTION 'work item % does not exist', NEW.item_id USING ERRCODE = 'check_violation';
    END IF;
    IF NOT in_team(lead, NEW.actor) THEN
      RAISE EXCEPTION 'event actor % is not in the team of %', NEW.actor, lead USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_event_append_only ON work_item_events;
CREATE TRIGGER trg_enforce_event_append_only
  BEFORE INSERT OR UPDATE OR DELETE ON work_item_events
  FOR EACH ROW EXECUTE FUNCTION enforce_event_append_only();
