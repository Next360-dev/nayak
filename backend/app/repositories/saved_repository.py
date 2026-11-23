"""
repositories/saved_repository.py - a user's private saved stories.
"""
from app.core.database import get_connection

_COLS = "id, article_id, title, url, summary, place, source, tone, published_at, saved_at"


def _row(r) -> dict:
    iso = lambda v: v.isoformat() if v else None  # noqa: E731
    return {"id": r[0], "article_id": r[1], "title": r[2], "url": r[3], "summary": r[4], "place": r[5],
            "source": r[6], "tone": r[7], "published_at": iso(r[8]), "saved_at": iso(r[9])}


def story_key(article_id, url) -> str | None:
    if article_id is not None:
        return f"a:{article_id}"
    if url:
        return f"u:{url}"
    return None


def list_for(username: str, limit: int = 200) -> list[dict]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT {_COLS} FROM saved_stories WHERE username=%s ORDER BY saved_at DESC, id DESC LIMIT %s", (username, limit))
        rows = [_row(r) for r in cur.fetchall()]
        cur.close()
    finally:
        conn.close()
    return rows


def save(username: str, key: str, d: dict) -> dict:
    """Idempotent: saving the same story again returns the existing row."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO saved_stories (username, story_key, article_id, title, url, summary, place, source, tone, published_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
            "ON CONFLICT (username, story_key) DO UPDATE SET title = saved_stories.title "
            f"RETURNING {_COLS}",
            (username, key, d.get("article_id"), d["title"], d.get("url"), d.get("summary"), d.get("place"),
             d.get("source"), d.get("tone"), d.get("published_at")),
        )
        row = _row(cur.fetchone())
        conn.commit()
        cur.close()
    finally:
        conn.close()
    return row


def remove(username: str, saved_id: int) -> bool:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM saved_stories WHERE id=%s AND username=%s", (saved_id, username))
        gone = cur.rowcount > 0
        conn.commit()
        cur.close()
    finally:
        conn.close()
    return gone
