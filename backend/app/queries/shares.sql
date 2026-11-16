-- =============================================================================
-- SHARES QUERIES
-- Admin <-> leader sharing: a share has many recipients, each with own status + thread
-- =============================================================================

-- name: insert_share
INSERT INTO shares (sender, article_id, title, url, summary, district_name, constituency_name, note, priority)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
RETURNING id;

-- name: insert_recipient
INSERT INTO share_recipients (share_id, recipient) VALUES (%s, %s)
ON CONFLICT (share_id, recipient) DO NOTHING;

-- name: inbox
SELECT s.id, s.sender, s.article_id, s.title, s.url, s.summary, s.district_name,
       s.constituency_name, s.note, s.priority, s.created_at,
       r.status, r.seen_at, r.updated_at,
       (SELECT COUNT(*) FROM share_replies p WHERE p.share_id = s.id AND p.recipient = r.recipient)
FROM share_recipients r
JOIN shares s ON s.id = r.share_id
WHERE r.recipient = %s
ORDER BY (r.status = 'done'), (s.priority = 'urgent') DESC, s.created_at DESC
LIMIT %s;

-- name: unread_count
SELECT COUNT(*) FROM share_recipients WHERE recipient = %s AND status = 'new';

-- name: sent_list
SELECT s.id, s.sender, s.article_id, s.title, s.url, s.summary, s.district_name,
       s.constituency_name, s.note, s.priority, s.created_at
FROM shares s
WHERE (%s OR s.sender = %s)
ORDER BY s.created_at DESC
LIMIT %s;

-- name: recipients_for_shares
SELECT share_id, recipient, status, seen_at, updated_at
FROM share_recipients
WHERE share_id = ANY(%s)
ORDER BY recipient;

-- name: get_share
SELECT id, sender, article_id, title, url, summary, district_name,
       constituency_name, note, priority, created_at
FROM shares WHERE id = %s;

-- name: get_recipient_row
SELECT status, seen_at, updated_at FROM share_recipients WHERE share_id = %s AND recipient = %s;

-- name: update_status
UPDATE share_recipients
SET status = %s,
    seen_at = CASE WHEN seen_at IS NULL AND %s <> 'new' THEN NOW() ELSE seen_at END,
    updated_at = NOW()
WHERE share_id = %s AND recipient = %s;

-- name: insert_reply
INSERT INTO share_replies (share_id, recipient, author, body) VALUES (%s, %s, %s, %s)
RETURNING id, created_at;

-- name: replies_for
SELECT id, recipient, author, body, created_at
FROM share_replies
WHERE share_id = %s AND (%s::text IS NULL OR recipient = %s)
ORDER BY created_at;
