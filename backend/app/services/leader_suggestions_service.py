"""Persist recommendations and record leader assignments to office staff."""
import logging
from datetime import datetime, timezone

from app.core.database import get_connection
from app.repositories import audit_repository
from app.services.recommendation_service import _recommendation_key, recommend_for_leader

logger = logging.getLogger(__name__)


def build_suggestions(leader_username: str) -> list[dict]:
    """Generate model-assisted/fallback recommendations and return saved office suggestions."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, source, item_id, title, suggestion, status, created_at, approved_at, assigned_to "
                "FROM leader_suggestions WHERE leader_username = %s ORDER BY created_at DESC",
                (leader_username,),
            )
            rows = cur.fetchall() or []
    finally:
        conn.close()
    existing = {_recommendation_key(r[1], r[2]) for r in rows}
    new_entries: list[tuple] = []

    for item in recommend_for_leader(leader_username, exclude=existing):
        key = _recommendation_key(item["source"], item["item_id"])
        if key in existing:
            continue
        new_entries.append((leader_username, item["source"], item["item_id"], item["title"], item["suggestion"]))
        existing.add(key)

    if new_entries:
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                for (lu, src, iid, title, sug) in new_entries:
                    cur.execute(
                        "INSERT INTO leader_suggestions (leader_username, source, item_id, title, suggestion, "
                        "status, created_at) VALUES (%s, %s, %s, %s, %s, 'pending', %s)",
                        (lu, src, iid, title, sug, datetime.now(timezone.utc)),
                    )
                conn.commit()
        finally:
            conn.close()

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, source, item_id, title, suggestion, status, created_at, approved_at, assigned_to "
                "FROM leader_suggestions WHERE leader_username = %s ORDER BY created_at DESC",
                (leader_username,),
            )
            rows = cur.fetchall() or []
    finally:
        conn.close()
    return [{
        "id": r[0], "source": r[1], "item_id": r[2], "title": r[3], "suggestion": r[4],
        "status": r[5], "created_at": r[6].isoformat() if r[6] else None,
        "approved_at": r[7].isoformat() if r[7] else None, "assigned_to": r[8],
    } for r in rows]


def approve_suggestion(user: dict, suggestion_id: int, assigned_to: str | None = None) -> dict:
    if user["role"] not in ("mla", "minister"):
        raise ValueError("only leaders can approve suggestions")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT leader_username, status FROM leader_suggestions WHERE id = %s", (suggestion_id,)
            )
            row = cur.fetchone()
            if not row:
                raise ValueError("suggestion not found")
            leader, status = row
            if user["username"] != leader:
                raise ValueError("not your suggestion")
            if status != "pending":
                raise ValueError("already decided")
            cur.execute(
                "UPDATE leader_suggestions SET status = 'approved', assigned_to = %s, approved_at = %s WHERE id = %s "
                "RETURNING id, leader_username, source, item_id, title, suggestion, status, approved_at, assigned_to",
                (assigned_to, datetime.now(timezone.utc), suggestion_id),
            )
            r = cur.fetchone()
            audit_repository.log("suggestion_approved", actor=user["username"], target=leader,
                                 detail={"id": suggestion_id})
            conn.commit()
            return {
                "id": r[0], "leader_username": r[1], "source": r[2], "item_id": r[3], "title": r[4],
                "suggestion": r[5], "status": r[6], "approved_at": r[7].isoformat() if r[7] else None,
                "assigned_to": r[8],
            }
    finally:
        conn.close()
