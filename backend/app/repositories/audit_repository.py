"""
repositories/audit_repository.py - the audit log (who did what) and the login-lockout counter.

Writing to the log must NEVER break the request it describes, so `log()` swallows its own errors.
Never put passwords, tokens or message bodies in `detail`.
"""
import json
import logging

from app.core.database import get_connection

logger = logging.getLogger(__name__)


def log(action: str, actor: str | None = None, target: str | None = None, detail: dict | None = None,
        ip: str | None = None) -> None:
    try:
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute("INSERT INTO audit_log (actor, action, target, detail, ip) VALUES (%s, %s, %s, %s::jsonb, %s)",
                        (actor, action, target, json.dumps(detail or {}), ip))
            conn.commit()
            cur.close()
        finally:
            conn.close()
    except Exception:
        logger.warning("audit log write failed for %s", action, exc_info=True)


def recent(limit: int = 50, q: str | None = None, action: str | None = None) -> list[dict]:
    where, params = [], []
    if action:
        where.append("action = %s"); params.append(action)
    if q:
        where.append("(actor ILIKE %s OR target ILIKE %s OR action ILIKE %s)"); params += [f"%{q}%"] * 3
    sql = "SELECT id, at, actor, action, target, detail, ip FROM audit_log"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY at DESC, id DESC LIMIT %s"
    params.append(max(1, min(500, limit)))
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()
    return [{"id": r[0], "at": r[1].isoformat(), "actor": r[2], "action": r[3], "target": r[4], "detail": r[5], "ip": r[6]} for r in rows]


def failed_logins_in_window(username: str, ip: str, window_seconds: int) -> int:
    """Failed logins for this username+ip in the window, counted only after the last successful login."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT COUNT(*) FROM audit_log
               WHERE action = 'login_failed' AND target = %s AND ip = %s
                 AND at > GREATEST(NOW() - (%s || ' seconds')::interval,
                                   COALESCE((SELECT MAX(at) FROM audit_log WHERE action = 'login_ok' AND target = %s AND ip = %s),
                                            'epoch'::timestamptz))""",
            (username, ip, str(window_seconds), username, ip))
        n = cur.fetchone()[0]
        cur.close()
    finally:
        conn.close()
    return n
