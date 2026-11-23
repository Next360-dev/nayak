"""
services/composed_posts_service.py - Compose + schedule + leader approval +
saved drafts for posts going out to platforms.
"""
import logging
import base64
import binascii
import re
from datetime import datetime, timezone

from app.core.database import get_connection
from app.repositories import audit_repository, user_repository

logger = logging.getLogger(__name__)
MAX_IMAGE_BYTES = 2 * 1024 * 1024


def _validated_image_data_url(value: str | None) -> str | None:
    if value in (None, ""):
        return None
    if not isinstance(value, str) or len(value) > 2_850_000:
        raise ValueError("image must be a JPEG, PNG, or WebP file up to 2 MB")
    match = re.fullmatch(r"data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})", value)
    if not match:
        raise ValueError("image must be a JPEG, PNG, or WebP file")
    media_type, encoded = match.groups()
    try:
        contents = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("image data is invalid")
    if not contents or len(contents) > MAX_IMAGE_BYTES:
        raise ValueError("image must be no larger than 2 MB")
    signatures = {
        "jpeg": contents.startswith(b"\xff\xd8\xff"),
        "png": contents.startswith(b"\x89PNG\r\n\x1a\n"),
        "webp": len(contents) >= 12 and contents.startswith(b"RIFF") and contents[8:12] == b"WEBP",
    }
    if not signatures[media_type]:
        raise ValueError("image file contents do not match the selected image type")
    return value


def _row(r) -> dict:
    return {
        "id": r[0], "leader_username": r[1], "owner_username": r[2], "title": r[3], "body": r[4],
        "platforms": r[5] or [], "scheduled_at": r[6].isoformat() if r[6] else None,
        "status": r[7], "approved_at": r[8].isoformat() if r[8] else None,
        "created_at": r[9].isoformat() if r[9] else None, "image_data": r[10],
    }


def list_composed_posts(user: dict) -> list[dict]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            role = user["role"]
            if role == "admin":
                cur.execute(
                    "SELECT id, leader_username, owner_username, title, body, platforms, scheduled_at, "
                    "status, approved_at, created_at, image_data FROM composed_posts ORDER BY created_at DESC"
                )
            elif role in ("mla", "minister"):
                cur.execute(
                    "SELECT id, leader_username, owner_username, title, body, platforms, scheduled_at, "
                    "status, approved_at, created_at, image_data FROM composed_posts WHERE leader_username = %s "
                    "ORDER BY created_at DESC",
                    (user["username"],),
                )
            else:  # staff
                leader = user.get("mla_username") or user["username"]
                cur.execute(
                    "SELECT id, leader_username, owner_username, title, body, platforms, scheduled_at, "
                    "status, approved_at, created_at, image_data FROM composed_posts WHERE leader_username = %s "
                    "ORDER BY created_at DESC",
                    (leader,),
                )
            rows = cur.fetchall() or []
    finally:
        conn.close()
    return [_row(r) for r in rows]


def create_composed_post(user: dict, title: str, body: str, platforms: list[str], scheduled_at, image_data: str | None = None) -> dict:
    image_data = _validated_image_data_url(image_data)
    leader = user["username"] if user["role"] in ("mla", "minister") else (user.get("mla_username") or user["username"])
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO composed_posts (leader_username, owner_username, title, body, platforms, "
                "scheduled_at, status, created_at, image_data) VALUES (%s, %s, %s, %s, %s, %s, 'draft', %s, %s) "
                "RETURNING id, created_at",
                (leader, user["username"], title, body, platforms, scheduled_at, datetime.now(timezone.utc), image_data),
            )
            row = cur.fetchone()
            audit_repository.log("composed_post_created", actor=user["username"], target=leader,
                                 detail={"id": row[0], "title": title})
            conn.commit()
            return _row((row[0], leader, user["username"], title, body, platforms, scheduled_at, "draft", None, row[1], image_data))
    finally:
        conn.close()


def update_composed_post_status(user: dict, post_id: int, status: str) -> dict:
    if status not in ("approved", "rejected"):
        raise ValueError("status must be approved or rejected")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT leader_username, owner_username, status FROM composed_posts WHERE id = %s", (post_id,)
            )
            row = cur.fetchone()
            if not row:
                raise ValueError("post not found")
            leader, owner, current = row
            if user["role"] not in ("mla", "minister"):
                raise ValueError("leaders approve office posts")
            if user["role"] in ("mla", "minister") and user["username"] != leader:
                raise ValueError("not your office")
            if user["role"] == "staff":
                raise ValueError("staff cannot approve/reject")
            cur.execute(
                "UPDATE composed_posts SET status = %s, approved_at = %s WHERE id = %s "
                "RETURNING id, leader_username, owner_username, title, body, platforms, scheduled_at, status, approved_at, created_at, image_data",
                (status, datetime.now(timezone.utc), post_id),
            )
            r = cur.fetchone()
            audit_repository.log("composed_post_decided", actor=user["username"], target=leader,
                                 detail={"id": post_id, "status": status})
            conn.commit()
            return _row(r)
    finally:
        conn.close()
