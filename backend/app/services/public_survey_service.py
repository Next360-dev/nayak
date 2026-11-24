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


MAX_MESSAGE, MAX_SHORT, MAX_EMAIL = 2000, 100, 200


def clean_submission(role, category, message, name, email) -> tuple[str, str, str, str, str]:
    """Trim and bound every public input (anyone on the internet can post here). Raises ValueError with a plain reason."""
    message = (message or "").strip()
    if not message:
        raise ValueError("message is required")
    if len(message) > MAX_MESSAGE:
        raise ValueError(f"message is too long (max {MAX_MESSAGE} characters)")
    role, category, name = ((v or "").strip() for v in (role, category, name))
    email = (email or "").strip()
    if any(len(v) > MAX_SHORT for v in (role, category, name)):
        raise ValueError(f"role, category and name must be at most {MAX_SHORT} characters")
    if email and (len(email) > MAX_EMAIL or "@" not in email or " " in email):
        raise ValueError("email is not valid")
    return role, category, message, name, email


def submit_survey(ip: str, role: str, category: str, message: str, name: str | None, email: str | None) -> dict:
    role, category, message, name, email = clean_submission(role, category, message, name, email)
    if not _allow_ip(ip or "unknown"):
        raise ValueError("rate limit exceeded; try again later")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO public_survey_responses (ip, role, category, message, name, email, created_at) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id, created_at",
                (ip, role, category, message, name, email,
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
                "SELECT id, role, category, message, name, email, created_at "
                "FROM public_survey_responses ORDER BY created_at DESC"
            )
            rows = cur.fetchall() or []
    finally:
        conn.close()
    # The respondent's IP is kept only for rate limiting; it is never returned.
    return [{
        "id": r[0], "role": r[1], "category": r[2], "message": r[3],
        "name": r[4], "email": r[5], "created_at": r[6].isoformat() if r[6] else None,
    } for r in rows]
