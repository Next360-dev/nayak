-- =============================================================================
-- USERS QUERIES
-- Pure SQL queries for user authentication and user profile management
-- =============================================================================

-- name: find_user_by_username
-- Staff users inherit constituency / district / politician from the MLA or minister they work for.
-- Last column is that boss's role (NULL for non-staff).
SELECT u.username, u.role,
       COALESCE(m.politician_name, u.politician_name),
       COALESCE(m.constituency_name, u.constituency_name),
       COALESCE(m.district_name, u.district_name),
       u.password_hash,
       u.mla_username,
       m.role,
       u.password_changed_at,
       COALESCE(m.leader_title, u.leader_title),
       COALESCE(m.leader_party, u.leader_party),
       u.must_change_password
FROM users u
LEFT JOIN users m ON u.role = 'staff' AND LOWER(m.username) = LOWER(u.mla_username)
WHERE LOWER(u.username) = %s AND u.is_active = TRUE;

-- name: create_user
INSERT INTO users (username, password_hash, role, politician_name, constituency_name, district_name, mla_username, must_change_password)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s);

-- name: set_password
UPDATE users SET password_hash = %s, password_changed_at = NOW() WHERE LOWER(username) = %s;

-- name: update_last_login
UPDATE users
SET last_login = CURRENT_TIMESTAMP
WHERE LOWER(username) = %s;




-- name: leaders_overview
-- Master-admin view: every active MLA and minister with their activity.
SELECT u.username, u.role, u.politician_name, u.constituency_name, u.district_name, u.last_login,
       (SELECT COUNT(*) FROM users s
         WHERE s.role = 'staff' AND s.is_active = TRUE AND LOWER(s.mla_username) = LOWER(u.username)) AS staff_count,
       COALESCE(sr.n_new, 0), COALESCE(sr.n_seen, 0), COALESCE(sr.n_acting, 0), COALESCE(sr.n_done, 0),
       sr.oldest_new, sr.last_action, u.leader_title
FROM users u
LEFT JOIN (
  SELECT LOWER(r.recipient) AS who,
         COUNT(*) FILTER (WHERE r.status = 'new')    AS n_new,
         COUNT(*) FILTER (WHERE r.status = 'seen')   AS n_seen,
         COUNT(*) FILTER (WHERE r.status = 'acting') AS n_acting,
         COUNT(*) FILTER (WHERE r.status = 'done')   AS n_done,
         MIN(sh.created_at) FILTER (WHERE r.status = 'new') AS oldest_new,
         MAX(r.updated_at)  FILTER (WHERE r.status <> 'new') AS last_action
  FROM share_recipients r JOIN shares sh ON sh.id = r.share_id
  GROUP BY LOWER(r.recipient)
) sr ON sr.who = LOWER(u.username)
WHERE u.role IN ('mla', 'minister') AND u.is_active = TRUE
ORDER BY u.role, u.district_name, u.constituency_name, u.username;

-- name: list_staff_of
SELECT username, last_login, is_active
FROM users
WHERE role = 'staff' AND LOWER(mla_username) = %s
ORDER BY username;

-- name: staff_exists_for
SELECT 1 FROM users WHERE role = 'staff' AND LOWER(mla_username) = %s AND LOWER(username) = %s;

-- name: set_active
UPDATE users SET is_active = %s WHERE LOWER(username) = %s;


-- name: list_all_users
SELECT u.username, u.role, COALESCE(m.politician_name, u.politician_name), COALESCE(m.constituency_name, u.constituency_name),
       COALESCE(m.district_name, u.district_name), u.mla_username, u.last_login, u.is_active
FROM users u
LEFT JOIN users m ON u.role = 'staff' AND LOWER(m.username) = LOWER(u.mla_username)
ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'minister' THEN 1 WHEN 'mla' THEN 2 ELSE 3 END,
         u.district_name, u.constituency_name, u.username;

-- name: user_role_any
SELECT role FROM users WHERE LOWER(username) = %s;


-- name: contact_of
SELECT username, role, email, phone, alerts_enabled, lang, politician_name FROM users WHERE LOWER(username) = %s AND is_active = TRUE;

-- name: set_profile
UPDATE users SET email = %s, phone = %s, alerts_enabled = %s, lang = %s WHERE LOWER(username) = %s;

-- name: list_alertable_users
SELECT username, role, email, phone, alerts_enabled, lang, politician_name
FROM users WHERE is_active = TRUE AND alerts_enabled = TRUE AND email IS NOT NULL AND email <> '' ORDER BY username;
