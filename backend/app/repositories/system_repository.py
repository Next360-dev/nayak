"""
repositories/system_repository.py - read-only health facts for the master admin.
"""
from app.core.database import get_connection


def news_freshness() -> dict:
    """How many stories arrived in the last 24 h and when the newest one arrived."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'), MAX(created_at) FROM new_articles")
        n, latest = cur.fetchone()
        cur.close()
    finally:
        conn.close()
    return {"articles_last_24h": n or 0, "latest_article_at": latest.isoformat() if latest else None, "_latest": latest}
