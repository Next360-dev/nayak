"""
api/routes/board.py - the team board: tasks, notes and the staff-edited morning briefing.

GET    /api/board                      tasks + the people a task can be given to (my team only)
POST   /api/board/tasks                staff: add a task (optionally from a story)
PATCH  /api/board/tasks/{id}           staff: change status / person / due date
GET    /api/board/tasks/{id}/notes     anyone in the team
POST   /api/board/tasks/{id}/notes     staff and the leader of the team
GET    /api/team/briefing?lang=        staff: the leader's briefing as it will go out today
PUT    /api/team/briefing              staff: replace today's briefing text for the leader
DELETE /api/team/briefing?lang=        staff: go back to the automatic text

A team = one MLA/minister + their own staff. Everything is keyed by the leader's username taken from the
signed login (never from the request), so another team's task answers 404. The master admin has no team
and gets 403. Leaders only look: they can read the board and write notes, not create or move tasks.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.deps import require_roles
from app.core.config import settings
from app.repositories import audit_repository, board_repository, user_repository
from app.services import briefing_service, notify_service

router = APIRouter()

require_team = require_roles("mla", "minister", "staff")
require_staff = require_roles("staff")


def team_of(user: dict) -> str:
    """The leader's username for this person's team (a leader's team is their own)."""
    leader = user["username"].lower() if user["role"] in ("mla", "minister") else (user.get("mla_username") or "").lower()
    if not leader:
        raise HTTPException(status_code=409, detail="You are not linked to an MLA or minister yet. Ask your admin.")
    return leader


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    note: str | None = Field(default=None, max_length=1000)
    url: str | None = Field(default=None, max_length=1000)
    assigned_to: str | None = Field(default=None, max_length=100)
    due_date: date | None = None


class TaskUpdate(BaseModel):
    status: str | None = Field(default=None, pattern="^(todo|doing|done)$")
    assigned_to: str | None = Field(default=None, max_length=100)    # "" or null = nobody
    due_date: date | None = None                                     # null = no date


class NoteCreate(BaseModel):
    body: str = Field(min_length=1, max_length=1000)


class BriefingEdit(BaseModel):
    lang: str = Field(pattern="^(en|te)$")
    body: str = Field(min_length=1, max_length=4000)


def _check_assignee(leader: str, who: str | None) -> str | None:
    who = (who or "").strip().lower() or None
    if who and who not in board_repository.team_members(leader):
        raise HTTPException(status_code=422, detail="That person is not in your team.")
    return who


def _task_or_404(task_id: int, leader: str) -> dict:
    task = board_repository.get_task(task_id, leader)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


_TASK_MAIL = {
    "en": ("New task for you: {title}", "{who} gave you a task:\n\n{title}\n\nOpen the app: {url}\n"),
    "te": ("మీకు కొత్త పని: {title}", "{who} మీకు ఒక పని ఇచ్చారు:\n\n{title}\n\nయాప్ తెరవండి: {url}\n"),
}


def _tell_assignee(task: dict, actor: str) -> None:
    """Email the person a task was given to (not when they gave it to themselves). Silent unless email is set up;
    one email per (task, person), so moving it back and forth never repeats it. Never breaks the request."""
    who = task.get("assigned_to")
    if not who or who == actor:
        return
    contact = user_repository.contact_of(who) or {}
    subject, body = _TASK_MAIL.get(contact.get("lang"), _TASK_MAIL["en"])
    notify_service.deliver("task", f"{task['id']}", who, subject.format(title=task["title"]),
                           body.format(who=actor, title=task["title"], url=settings.APP_BASE_URL))


@router.get("/api/board")
def board(user: dict = Depends(require_team)):
    leader = team_of(user)
    return {"status": "success", "leader": leader, "can_manage": user["role"] == "staff", "me": user["username"].lower(),
            "members": board_repository.team_members(leader), "tasks": board_repository.list_tasks(leader)}


@router.post("/api/board/tasks")
def add_task(payload: TaskCreate, user: dict = Depends(require_staff)):
    leader = team_of(user)
    who = _check_assignee(leader, payload.assigned_to)
    task_id = board_repository.create_task(leader, user["username"].lower(), payload.title.strip(),
                                           (payload.note or "").strip() or None, (payload.url or "").strip() or None, who, payload.due_date)
    audit_repository.log("task_created", actor=user["username"], target=leader, detail={"task": task_id})
    task = board_repository.get_task(task_id, leader)
    _tell_assignee(task, user["username"].lower())
    return {"status": "success", "task": task}


@router.patch("/api/board/tasks/{task_id}")
def change_task(task_id: int, payload: TaskUpdate, user: dict = Depends(require_staff)):
    leader = team_of(user)
    _task_or_404(task_id, leader)
    fields: dict = {}
    sent = payload.model_fields_set
    if "status" in sent and payload.status:
        fields["status"] = payload.status
    if "assigned_to" in sent:
        fields["assigned_to"] = _check_assignee(leader, payload.assigned_to)
    if "due_date" in sent:
        fields["due_date"] = payload.due_date
    board_repository.update_task(task_id, leader, fields)
    audit_repository.log("task_updated", actor=user["username"], target=leader, detail={"task": task_id, "fields": sorted(fields)})
    task = board_repository.get_task(task_id, leader)
    if "assigned_to" in fields:
        _tell_assignee(task, user["username"].lower())
    return {"status": "success", "task": task}


@router.get("/api/board/tasks/{task_id}/notes")
def task_notes(task_id: int, user: dict = Depends(require_team)):
    _task_or_404(task_id, team_of(user))
    return {"status": "success", "notes": board_repository.notes_for(task_id)}


@router.post("/api/board/tasks/{task_id}/notes")
def add_task_note(task_id: int, payload: NoteCreate, user: dict = Depends(require_team)):
    _task_or_404(task_id, team_of(user))
    note = board_repository.add_note(task_id, user["username"].lower(), payload.body.strip())
    return {"status": "success", "note": note}


# ── staff-edited morning briefing ────────────────────────────────────────────
def _leader_user(user: dict) -> tuple[str, dict]:
    leader = team_of(user)
    boss = user_repository.find_user_by_username(leader)
    if not boss:
        raise HTTPException(status_code=409, detail="Your leader's login is disabled.")
    return leader, boss


@router.get("/api/team/briefing")
def team_briefing(lang: str = Query("en", pattern="^(en|te)$"), user: dict = Depends(require_staff)):
    leader, boss = _leader_user(user)
    auto = briefing_service.build(boss, lang, use_edit=False)
    edit = board_repository.get_briefing_edit(leader, lang, briefing_service.today())
    return {"status": "success", "leader": leader, "auto": auto["text"], "text": edit["body"] if edit else auto["text"],
            "edited": bool(edit), "edited_by": edit["edited_by"] if edit else None, "updated_at": edit["updated_at"] if edit else None}


@router.put("/api/team/briefing")
def save_team_briefing(payload: BriefingEdit, user: dict = Depends(require_staff)):
    leader, _ = _leader_user(user)
    board_repository.save_briefing_edit(leader, payload.lang, briefing_service.today(), payload.body.strip(), user["username"].lower())
    audit_repository.log("briefing_edited", actor=user["username"], target=leader, detail={"lang": payload.lang})
    return {"status": "success"}


@router.delete("/api/team/briefing")
def reset_team_briefing(lang: str = Query("en", pattern="^(en|te)$"), user: dict = Depends(require_staff)):
    leader, _ = _leader_user(user)
    board_repository.delete_briefing_edit(leader, lang, briefing_service.today())
    audit_repository.log("briefing_reset", actor=user["username"], target=leader, detail={"lang": lang})
    return {"status": "success"}
