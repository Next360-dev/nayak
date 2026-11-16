"""
repositories/feedback_repository.py - "this story is wrong" reports and free-text app feedback.
"""
from app.core.database import get_connection


def _run(sql, params=(), fetch=None, commit=False):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        out = cur.fetchall() if fetch == "all" else cur.fetchone() if fetch == "one" else None
        if commit:
            conn.commit()
        cur.close()
        return out
    finally:
        conn.close()


def add_story_feedback(article_id: int | None, title: str, kind: str, note: str | None, username: str) -> bool:
    """True if it was new, False if this person already reported this story for this reason."""
    row = _run("INSERT INTO story_feedback (article_id, title, kind, note, username) VALUES (%s,%s,%s,%s,%s) "
               "ON CONFLICT (article_id, kind, username) DO NOTHING RETURNING id",
               (article_id, (title or "")[:300], kind, (note or "")[:500] or None, username.lower()), fetch="one", commit=True)
    return row is not None


def quality_summary(days: int = 7) -> dict:
    kinds = _run("SELECT kind, COUNT(*) FROM story_feedback WHERE at > NOW() - (%s || ' days')::interval GROUP BY kind",
                 (str(days),), fetch="all") or []
    top = _run("""SELECT article_id, MAX(title), COUNT(*), ARRAY_AGG(DISTINCT kind) FROM story_feedback
                  WHERE at > NOW() - (%s || ' days')::interval GROUP BY article_id ORDER BY COUNT(*) DESC, MAX(at) DESC LIMIT 5""",
               (str(days),), fetch="all") or []
    return {
        "days": days,
        "by_kind": {"not_relevant": 0, "wrong_priority": 0, "wrong_sentiment": 0, **{k: n for k, n in kinds}},
        "total": sum(n for _, n in kinds),
        "top": [{"article_id": a, "title": t, "reports": n, "kinds": ks} for a, t, n, ks in top],
    }


def add_app_feedback(username: str, message: str) -> None:
    _run("INSERT INTO app_feedback (username, message) VALUES (%s,%s)", (username.lower(), message.strip()[:2000]), commit=True)


def recent_app_feedback(limit: int = 5) -> list[dict]:
    rows = _run("SELECT at, username, message FROM app_feedback ORDER BY at DESC, id DESC LIMIT %s", (limit,), fetch="all") or []
    return [{"at": a.isoformat(), "username": u, "message": m} for a, u, m in rows]
