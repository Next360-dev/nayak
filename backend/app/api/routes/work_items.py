"""
api/routes/work_items.py - letters & petitions with approval.

GET    /api/work-items                 list (mine=1: created_by or assignee is me)
GET    /api/work-items/{id}            item + events + can{edit,submit,decide,close,comment}
POST   /api/work-items                 create (draft) + 'created' event
PATCH  /api/work-items/{id}            edit (only draft / changes_requested) + 'edited' event
POST   /api/work-items/{id}/submit     draft -> submitted; notifies the leader
POST   /api/work-items/{id}/decide     submitted -> approved/rejected/changes_requested (leader only)
POST   /api/work-items/{id}/comments   add a comment event
POST   /api/work-items/{id}/close      approved/rejected -> closed
GET    /api/work-items/pending-count   submitted count for the leader's team (0 for staff)

The master admin has no access to item content (404, never 403, never reveals existence).
Push/email failures never fail the request (fire-and-forget background tasks).
"""
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.repositories import audit_repository
from app.services import notify_service, push_service, work_item_service
from app.services.work_item_service import WorkItemRuleError

router = APIRouter()

MAX_TITLE = 200


def _rule(err: WorkItemRuleError) -> HTTPException:
    return HTTPException(status_code=err.status, detail=err.detail)


def _no_admin(user: dict) -> None:
    if user["role"] == "admin":
        raise HTTPException(status_code=404, detail="Work item not found")


class ItemCreate(BaseModel):
    kind: Literal["letter", "petition"]
    direction: Literal["incoming", "outgoing"]
    title: str = Field(min_length=1, max_length=MAX_TITLE)
    body: str | None = None
    reference_no: str | None = Field(default=None, max_length=200)
    counterpart: str | None = Field(default=None, max_length=200)
    priority: Literal["normal", "urgent"] = "normal"
    due_date: date | None = None
    assignee: str | None = Field(default=None, max_length=100)


class ItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=MAX_TITLE)
    body: str | None = None
    reference_no: str | None = Field(default=None, max_length=200)
    counterpart: str | None = Field(default=None, max_length=200)
    priority: Literal["normal", "urgent"] | None = None
    due_date: date | None = None
    assignee: str | None = Field(default=None, max_length=100)


class SubmitRequest(BaseModel):
    note: str | None = None


class DecideRequest(BaseModel):
    decision: Literal["approve", "reject", "changes"]
    note: str | None = None


class CommentRequest(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class CloseRequest(BaseModel):
    note: str | None = None


def _notify_and_push(sender: str, title: str, item_id: int, recipients: list[str], kind: str) -> None:
    """Notify recipient(s) and push. Failures never fail the request."""
    for rcpt in recipients or []:
        try:
            notify_service.deliver(kind, f"item:{item_id}", rcpt,
                                   f"Work item: {title[:80]}", f"Work item #{item_id}: {title[:120]}")
        except Exception:
            pass
    try:
        push_service.send_work_item_push(sender=sender, title=title, item_id=item_id,
                                         recipients=recipients)
    except Exception:
        pass


@router.post("/api/work-items")
def create_work_item(payload: ItemCreate, user: dict = Depends(get_current_user)):
    _no_admin(user)
    try:
        item = work_item_service.create_item(
            user, payload.kind, payload.direction, payload.title, payload.body,
            payload.reference_no, payload.counterpart, payload.priority,
            payload.due_date, payload.assignee)
    except WorkItemRuleError as err:
        raise _rule(err)
    _notify_and_push(user["username"].lower(), payload.title, item["id"],
                     [item["team_leader"]], "work_item_created")
    return {"status": "success", "item": item}


@router.get("/api/work-items")
def list_work_items(status: str | None = None, kind: str | None = None,
                    mine: int = 0, limit: int = 50, offset: int = 0,
                    user: dict = Depends(get_current_user)):
    _no_admin(user)
    limit = max(1, min(200, limit))
    offset = max(0, offset)
    try:
        return work_item_service.list_items(user, status, kind, bool(mine), limit, offset)
    except WorkItemRuleError as err:
        raise _rule(err)


@router.get("/api/work-items/pending-count")
def pending_count(user: dict = Depends(get_current_user)):
    _no_admin(user)
    return work_item_service.pending_count(user)


@router.get("/api/work-items/{item_id}")
def get_work_item(item_id: int, user: dict = Depends(get_current_user)):
    _no_admin(user)
    try:
        item = work_item_service.get_item(user, item_id)
        events = item.pop("events")
        can = item.pop("can")
        return {"status": "success", "item": item, "events": events, "can": can}
    except WorkItemRuleError as err:
        raise _rule(err)


@router.patch("/api/work-items/{item_id}")
def update_work_item(item_id: int, payload: ItemUpdate, user: dict = Depends(get_current_user)):
    _no_admin(user)
    fields = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    try:
        item = work_item_service.update_item(user, item_id, fields)
    except WorkItemRuleError as err:
        raise _rule(err)
    return {"status": "success", "item": item}


@router.post("/api/work-items/{item_id}/submit")
def submit_work_item(item_id: int, payload: SubmitRequest, user: dict = Depends(get_current_user)):
    _no_admin(user)
    try:
        item = work_item_service.submit_item(user, item_id, payload.note)
    except WorkItemRuleError as err:
        raise _rule(err)
    _notify_and_push(user["username"].lower(), item["title"], item["id"],
                     [item["team_leader"]], "work_item_submitted")
    return {"status": "success", "item": item}


@router.post("/api/work-items/{item_id}/decide")
def decide_work_item(item_id: int, payload: DecideRequest, user: dict = Depends(get_current_user)):
    _no_admin(user)
    try:
        item = work_item_service.decide_item(user, item_id, payload.decision, payload.note)
    except WorkItemRuleError as err:
        raise _rule(err)
    _notify_and_push(user["username"].lower(), item["title"], item["id"],
                     [item["created_by"]], "work_item_decided")
    return {"status": "success", "item": item}


@router.post("/api/work-items/{item_id}/comments")
def add_work_item_comment(item_id: int, payload: CommentRequest, user: dict = Depends(get_current_user)):
    _no_admin(user)
    try:
        event = work_item_service.comment_item(user, item_id, payload.body)
    except WorkItemRuleError as err:
        raise _rule(err)
    return {"status": "success", "event": event}


@router.post("/api/work-items/{item_id}/close")
def close_work_item(item_id: int, payload: CloseRequest, user: dict = Depends(get_current_user)):
    _no_admin(user)
    try:
        item = work_item_service.close_item(user, item_id, payload.note)
    except WorkItemRuleError as err:
        raise _rule(err)
    return {"status": "success", "item": item}

