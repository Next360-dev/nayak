"""
services/project_tracker_service.py - Project development tracker.
Staff post, admin sees (reuses the letters/work-item record pattern).
"""
import logging
from datetime import datetime, timezone

from app.core.database import get_connection
from app.repositories import audit_repository, user_repository

logger = logging.getLogger(__name__)


def _row(r) -> dict:
    return {
        "id": r[0], "leader_username": r[1], "owner_username": r[2], "title": r[3], "status": r[4],
        "milestones": r[5] or [], "photos": r[6] or [],
        "updated_at": r[7].isoformat() if r[7] else None,
        "created_at": r[8].isoformat() if r[8] else None,
    }


def list_projects(user: dict) -> list[dict]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            if user["role"] == "admin":
                cur.execute(
                    "SELECT id, leader_username, owner_username, title, status, milestones, photos, "
                    "updated_at, created_at FROM project_updates ORDER BY updated_at DESC"
                )
            else:
                leader = user["username"] if user["role"] in ("mla", "minister") else (
                    user.get("mla_username") or user["username"])
                cur.execute(
                    "SELECT id, leader_username, owner_username, title, status, milestones, photos, "
                    "updated_at, created_at FROM project_updates WHERE leader_username = %s "
                    "ORDER BY updated_at DESC",
                    (leader,),
                )
            rows = cur.fetchall() or []
    finally:
        conn.close()
    return [_row(r) for r in rows]


def create_project(user: dict, title: str, status: str, milestones: list, photos: list) -> dict:
    leader = user["username"] if user["role"] in ("mla", "minister") else (user.get("mla_username") or user["username"])
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO project_updates (leader_username, owner_username, title, status, milestones, photos, "
                "updated_at, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) "
                "RETURNING id, updated_at, created_at",
                (leader, user["username"], title, status, milestones, photos,
                 datetime.now(timezone.utc), datetime.now(timezone.utc)),
            )
            row = cur.fetchone()
            audit_repository.log("project_created", actor=user["username"], target=leader,
                                 detail={"id": row[0], "title": title})
            conn.commit()
            return _row((row[0], leader, user["username"], title, status, milestones, photos, row[1], row[2]))
    finally:
        conn.close()


def update_project(user: dict, project_id: int, title: str | None, status: str | None,
                   milestones: list | None, photos: list | None) -> dict:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT leader_username, owner_username FROM project_updates WHERE id = %s", (project_id,)
            )
            row = cur.fetchone()
            if not row:
                raise ValueError("project not found")
            leader, owner = row
            if user["role"] != "staff" or user.get("mla_username") != leader or user["username"] != owner:
                raise ValueError("not allowed")
            cur.execute(
                "UPDATE project_updates SET title = COALESCE(%s, title), status = COALESCE(%s, status), "
                "milestones = COALESCE(%s, milestones), photos = COALESCE(%s, photos), updated_at = %s "
                "WHERE id = %s RETURNING id, leader_username, owner_username, title, status, milestones, photos, updated_at, created_at",
                (title, status, milestones, photos, datetime.now(timezone.utc), project_id),
            )
            r = cur.fetchone()
            audit_repository.log("project_updated", actor=user["username"], target=leader,
                                 detail={"id": project_id})
            conn.commit()
            return _row(r)
    finally:
        conn.close()
