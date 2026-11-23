"""
services/whatsapp_service.py - WhatsApp chat paste/upload. Rules-based sorter
tags the chat and routes it to the staff and admin inbox.
"""
import logging
import re
from datetime import datetime, timezone

from app.core.database import get_connection
from app.repositories import audit_repository, user_repository
from app.services import notify_service

logger = logging.getLogger(__name__)

_RULES = [
    (r"\burgent\b|\bimmediately\b|\basap\b|\bright now\b", "urgent"),
    (r"\bmeeting\b|\bcall\b|\bappointment\b|\bschedule\b", "meeting"),
    (r"\bcomplaint\b|\bissue\b|\bproblem\b|\bgrievance\b", "complaint"),
    (r"\btask\b|\bcomplete\b|\bsubmit\b|\bdeliver\b", "task"),
    (r"\bthank you\b|\bthanks\b", "appreciation"),
    (r"\bshare\b|\bpost\b|\bpublish\b|\btweet\b", "content"),
    (r"\bmoney\b|\bpayment\b|\bfund\b|\bgrant\b|\bcheque\b", "finance"),
]


def _sort(raw_text: str) -> list[str]:
    text = (raw_text or "").lower()
    tags = []
    for pattern, tag in _RULES:
        if re.search(pattern, text):
            tags.append(tag)
    if not tags:
        tags = ["general"]
    return tags


def upload_whatsapp(user: dict, raw_text: str) -> dict:
    leader = user["username"] if user["role"] in ("mla", "minister") else (user.get("mla_username") or user["username"])
    tags = _sort(raw_text)
    route_to = ["staff", "admin"]
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO whatsapp_uploads (leader_username, owner_username, raw_text, tags, route_to, "
                "status, created_at) VALUES (%s, %s, %s, %s, %s, 'open', %s) "
                "RETURNING id, created_at",
                (leader, user["username"], raw_text, tags, route_to, datetime.now(timezone.utc)),
            )
            row = cur.fetchone()
            audit_repository.log("whatsapp_uploaded", actor=user["username"], target=leader,
                                 detail={"id": row[0], "tags": tags})
            conn.commit()
            upload_id = row[0]
    finally:
        conn.close()
    # Notify staff (routed to staff + admin inbox).
    staff = [s["username"] for s in user_repository.list_staff_of(leader)]
    preview = (raw_text or "")[:120].replace("\n", " ")
    body = (f"WhatsApp chat routed to staff + admin inbox ({leader})\n"
            f"Tags: {', '.join(tags)}\nPreview: {preview}\n")
    for s in staff:
        try:
            notify_service.deliver("whatsapp", f"wa:{upload_id}:{s}", s, "WhatsApp upload routed", body)
        except Exception:
            logger.warning("whatsapp notify failed for %s", s, exc_info=True)
    return {
        "id": upload_id, "leader_username": leader, "owner_username": user["username"],
        "tags": tags, "route_to": route_to, "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def list_uploads(user: dict) -> list[dict]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            if user["role"] == "admin":
                cur.execute(
                    "SELECT id, leader_username, owner_username, raw_text, tags, route_to, status, created_at "
                    "FROM whatsapp_uploads ORDER BY created_at DESC"
                )
            else:
                leader = user["username"] if user["role"] in ("mla", "minister") else (
                    user.get("mla_username") or user["username"])
                cur.execute(
                    "SELECT id, leader_username, owner_username, raw_text, tags, route_to, status, created_at "
                    "FROM whatsapp_uploads WHERE leader_username = %s ORDER BY created_at DESC",
                    (leader,),
                )
            rows = cur.fetchall() or []
    finally:
        conn.close()
    return [{
        "id": r[0], "leader_username": r[1], "owner_username": r[2], "raw_text": r[3],
        "tags": r[4] or [], "route_to": r[5] or [], "status": r[6],
        "created_at": r[7].isoformat() if r[7] else None,
    } for r in rows]
