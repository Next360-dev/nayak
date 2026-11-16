"""
repositories/notification_repository.py - the send-once log for alerts and briefings.
"""
from app.core.database import get_connection


def already_sent(kind: str, key: str, recipient: str) -> bool:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM notification_log WHERE kind=%s AND key=%s AND recipient=%s AND ok", (kind, key, recipient))
        found = cur.fetchone() is not None
        cur.close()
    finally:
        conn.close()
    return found


def record(kind: str, key: str, recipient: str, ok: bool, error: str | None = None, channel: str = "email") -> None:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO notification_log (kind, key, recipient, channel, ok, error) VALUES (%s,%s,%s,%s,%s,%s) "
                    "ON CONFLICT DO NOTHING", (kind, key, recipient, channel, ok, (error or "")[:300] or None))
        conn.commit()
        cur.close()
    finally:
        conn.close()
