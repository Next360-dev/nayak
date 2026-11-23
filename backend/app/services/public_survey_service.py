"""
services/public_survey_service.py - Public feedback / constituency survey.
Public form without login, spam-limited per IP; results page for staff/admin.
"""
import logging
import time
from collections import defaultdict
from datetime import datetime, timezone

from app.core.database import get_connection

logger = logging.getLogger(__name__)

_RATE_LIMIT = 5          # submissions per IP per hour
_RATE_WINDOW_SECONDS = 3600
_hits: dict[str, list[float]] = defaultdict(list)


def _allow_ip(ip: str) -> bool:
    now = time.time()
    window = now - _RATE_WINDOW_SECONDS
    hits = [t for t in _hits[ip] if t > window]
    _hits[ip] = hits
    if len(hits) >= _RATE_LIMIT:
        return False
    hits.append(now)
    return True


def submit_survey(ip: str, role: str, category: str, message: str, name: str | None, email: str | None) -> dict:
    if not message or not message.strip():
        raise ValueError("message is required")
    if not _allow_ip(ip or "unknown"):
        raise ValueError("rate limit exceeded; try again later")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO public_survey_responses (ip, role, category, message, name, email, created_at) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id, created_at",
                (ip, role or "", category or "", message.strip(), name or "", email or "",
                 datetime.now(timezone.utc)),
            )
            row = cur.fetchone()
            conn.commit()
            return {"id": row[0], "created_at": row[1].isoformat() if row[1] else None}
    finally:
        conn.close()


def list_responses() -> list[dict]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, ip, role, category, message, name, email, created_at "
                "FROM public_survey_responses ORDER BY created_at DESC"
            )
            rows = cur.fetchall() or []
    finally:
        conn.close()
    return [{
        "id": r[0], "ip": r[1], "role": r[2], "category": r[3], "message": r[4],
        "name": r[5], "email": r[6], "created_at": r[7].isoformat() if r[7] else None,
    } for r in rows]
