-- =============================================================================
-- USERS QUERIES
-- Pure SQL queries for user authentication and user profile management
-- =============================================================================

-- name: find_user_by_username
SELECT username, role, politician_name, constituency_name, district_name 
FROM users 
WHERE LOWER(username) = %s;

-- name: create_user
INSERT INTO users (username, password_hash, role, politician_name, constituency_name, district_name)
VALUES (%s, %s, %s, %s, %s, %s);

-- name: update_last_login
UPDATE users 
SET last_login = CURRENT_TIMESTAMP 
WHERE id = %s;

