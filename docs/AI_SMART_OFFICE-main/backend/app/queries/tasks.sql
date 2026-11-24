-- =============================================================================
-- TASKS QUERIES
-- Pure SQL queries for constituency tasks management
-- =============================================================================

-- name: fetch_tasks
SELECT id, title, department, status, priority 
FROM tasks 
ORDER BY created_at DESC 
LIMIT 50;

-- name: insert_task
INSERT INTO tasks (id, title, department, priority, status) 
VALUES (%s, %s, %s, %s, %s);
