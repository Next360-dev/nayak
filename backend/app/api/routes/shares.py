"""
api/routes/shares.py
Team <-> leader sharing. The master admin only WATCHES (read-only); it never shares.

GET   /api/shares/targets            who the caller may share to
POST  /api/shares                    share an article with one or many recipients
GET   /api/shares/inbox              caller's own inbox
GET   /api/shares/unread-count       badge number for the inbox
GET   /api/shares/sent               shares the caller sent (admin sees ALL shares, read-only)
PATCH /api/shares/{id}/status        recipient moves a share: seen / acting / done
GET   /api/shares/{id}/replies       reply thread
POST  /api/shares/{id}/replies       add a reply

Rules:
  - Staff may share ONLY to the MLA/minister they work for.
  - An MLA/minister may share ONLY to their own active staff.
  - The master admin cannot create shares, reply or change a status. It can read every share and thread.
  - Everyone has their own inbox (staff no longer read their leader's inbox).
  - A recipient only sees their own thread; the sender and the admin see every thread.
"""

from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import get_current_user, inbox_owner
from app.repositories import audit_repository, share_repository
from app.services import alerts_service, push_service, share_service
from app.services.share_service import ShareRuleError

router = APIRouter()

def _rule(err: ShareRuleError) -> HTTPException:
    return HTTPException(status_code=err.status, detail=err.detail)


class CreateShareRequest(BaseModel):
    article_id: int | None = None
    title: str = Field(min_length=1, max_length=500)
    url: str | None = Field(default=None, max_length=2000)
    summary: str | None = Field(default=None, max_length=5000)
    district_name: str | None = Field(default=None, max_length=200)
    constituency_name: str | None = Field(default=None, max_length=200)
    note: str | None = Field(default=None, max_length=2000)
    priority: Literal["normal", "urgent"] = "normal"
    recipients: list[str] = Field(default_factory=list)
    all_mlas: bool = False          # no longer allowed (kept so older clients get a clear 403)
    district: str | None = None     # no longer allowed


class StatusRequest(BaseModel):
    status: Literal["seen", "acting", "done"]


class ReplyRequest(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    recipient: str | None = None    # needed when the sender replies (picks whose thread)


@router.get("/api/shares/targets")
def share_targets(user: dict = Depends(get_current_user)):
    return {"status": "success", "targets": share_service.target_rows(user)}


@router.post("/api/shares")
def create_share(payload: CreateShareRequest, background_tasks: BackgroundTasks,
                  user: dict = Depends(get_current_user)):
    try:
        recipients = share_service.check_can_create(
            user, payload.recipients, broadcast=bool(payload.all_mlas or payload.district))
    except ShareRuleError as err:
        raise _rule(err)

    share_id = share_repository.create_share(
        sender=user["username"].lower(),
        article_id=payload.article_id,
        title=payload.title.strip(),
        url=payload.url,
        summary=payload.summary,
        district_name=payload.district_name,
        constituency_name=payload.constituency_name,
        note=payload.note,
        priority=payload.priority,
        recipients=recipients,
    )
    audit_repository.log("share_created", actor=user["username"].lower(), target=", ".join(recipients),
                         detail={"share_id": share_id, "title": payload.title.strip()[:80], "urgent": payload.priority == "urgent"})
    if background_tasks is not None and payload.priority == "urgent":
        background_tasks.add_task(alerts_service.notify_urgent_share, user["username"].lower(),
                                  payload.title.strip(), share_id, recipients, payload.note)
    if background_tasks is not None:
        background_tasks.add_task(
            push_service.send_share_push,
            sender=user["username"].lower(),
            share_title=payload.title.strip(),
            share_id=share_id,
            recipients=recipients,
            urgent=payload.priority == "urgent",
        )
    return {"status": "success", "share_id": share_id, "recipient_count": len(recipients)}


@router.get("/api/shares/inbox")
def get_inbox(user: dict = Depends(get_current_user)):
    return {"status": "success", "shares": share_repository.inbox(inbox_owner(user))}


@router.get("/api/shares/unread-count")
def get_unread_count(user: dict = Depends(get_current_user)):
    return {"status": "success", "count": share_repository.unread_count(inbox_owner(user))}


@router.get("/api/shares/sent")
def get_sent(user: dict = Depends(get_current_user)):
    shares = share_repository.sent(user["username"].lower(), user["role"] == "admin")
    return {"status": "success", "shares": shares}


@router.patch("/api/shares/{share_id}/status")
def update_status(share_id: int, payload: StatusRequest, user: dict = Depends(get_current_user)):
    try:
        share_service.check_not_admin(user)
    except ShareRuleError as err:
        raise _rule(err)
    owner = inbox_owner(user)
    if not share_repository.get_recipient_row(share_id, owner):
        raise HTTPException(status_code=404, detail="Share not found in your inbox.")
    share_repository.set_status(share_id, owner, payload.status)
    audit_repository.log("share_status", actor=owner, target=str(share_id), detail={"status": payload.status})
    return {"status": "success", "share_status": payload.status}


@router.get("/api/shares/{share_id}/replies")
def get_replies(share_id: int, recipient: str | None = None,
                user: dict = Depends(get_current_user)):
    share = share_repository.get_share(share_id)
    if not share:
        raise HTTPException(status_code=404, detail="Share not found.")

    owner = inbox_owner(user)
    if share_service.can_read_all_threads(user, share):
        who = recipient.strip().lower() if recipient else None
    elif share_repository.get_recipient_row(share_id, owner):
        who = owner                      # recipients only ever see their own thread
    else:
        raise HTTPException(status_code=404, detail="Share not found.")
    return {"status": "success", "replies": share_repository.replies(share_id, who)}


@router.post("/api/shares/{share_id}/replies")
def add_reply(share_id: int, payload: ReplyRequest, user: dict = Depends(get_current_user)):
    try:
        share_service.check_not_admin(user)
    except ShareRuleError as err:
        raise _rule(err)
    share = share_repository.get_share(share_id)
    if not share:
        raise HTTPException(status_code=404, detail="Share not found.")

    owner = inbox_owner(user)
    if share_repository.get_recipient_row(share_id, owner):
        thread = owner                   # a recipient replies in their own thread
    elif share["sender"] == owner:       # the sender replies to one recipient's thread
        if not payload.recipient:
            raise HTTPException(status_code=422, detail="recipient is required.")
        thread = payload.recipient.strip().lower()
        if not share_repository.get_recipient_row(share_id, thread):
            raise HTTPException(status_code=404, detail="That recipient is not on this share.")
    else:
        raise HTTPException(status_code=404, detail="Share not found.")

    reply = share_repository.add_reply(share_id, thread, user["username"].lower(),
                                       payload.body.strip())
    return {"status": "success", "reply": reply}
