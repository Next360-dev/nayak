-- =============================================================================
-- 004: The database itself enforces who may share to whom (defence in depth).
-- Safe to run more than once.
--   staff     -> only the MLA/minister they work for (users.mla_username)
--   mla/min.  -> only staff whose mla_username is that leader
--   admin     -> never a sender
-- Applies to NEW rows only; old rows are left untouched.
-- =============================================================================
CREATE OR REPLACE FUNCTION enforce_share_pair() RETURNS trigger AS $$
DECLARE
  s_name TEXT; s_role TEXT; s_boss TEXT;
  r_role TEXT; r_boss TEXT;
BEGIN
  SELECT sender INTO s_name FROM shares WHERE id = NEW.share_id;
  SELECT role, LOWER(mla_username) INTO s_role, s_boss FROM users WHERE LOWER(username) = LOWER(s_name);
  SELECT role, LOWER(mla_username) INTO r_role, r_boss FROM users WHERE LOWER(username) = LOWER(NEW.recipient);

  IF s_role = 'staff' AND r_role IN ('mla', 'minister') AND LOWER(NEW.recipient) = s_boss THEN
    RETURN NEW;
  END IF;
  IF s_role IN ('mla', 'minister') AND r_role = 'staff' AND r_boss = LOWER(s_name) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'share not allowed: % (%) -> % (%)', s_name, s_role, NEW.recipient, r_role
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_share_pair ON share_recipients;
CREATE TRIGGER trg_enforce_share_pair
  BEFORE INSERT ON share_recipients
  FOR EACH ROW EXECUTE FUNCTION enforce_share_pair();
