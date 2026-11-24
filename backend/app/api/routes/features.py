"""
api/routes/features.py - Milestone-1 task endpoints (top alerts, watchlist,
composed posts, project tracker, public survey, leader suggestions, WhatsApp
uploads). Auth = Bearer token; public survey is unauthenticated and spam-limited.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.deps import get_current_user
from app.repositories import user_repository
from app.services import (
    composed_posts_service,
    leader_suggestions_service,
    project_tracker_service,
    public_survey_service,
    top_alerts_service,
    watchlist_service,
    whatsapp_service,
)

router = APIRouter(prefix="")

def _leader_of(user: dict) -> str:
    if user["role"] in ("mla", "minister"):
        return user["username"]
    leader = user.get("mla_username") or user["username"]
    return leader


def _is_admin(user: dict) -> bool:
    return user["role"] == "admin"


# ── Watchlist ─────────────────────────────────────────────────────────────

@router.get("/api/watchlist")
def get_watchlist(user: dict = Depends(get_current_user)):
    if _is_admin(user):
        return {"status": "success", **watchlist_service.get_all_watchlist_activity()}
    leader_username = _leader_of(user)
    return {
        "status": "success",
        "names": watchlist_service.get_watchlist(leader_username),
        "posts": watchlist_service.get_watchlist_posts(leader_username),
    }


@router.post("/api/watchlist")
def set_watchlist(payload: dict, user: dict = Depends(get_current_user)):
    if user["role"] != "staff":
        raise HTTPException(status_code=403, detail="staff only")
    names = payload.get("names") or []
    try:
        watchlist_service.set_watchlist(_leader_of(user), names)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "success"}


@router.post("/api/watchlist/check-now")
def check_watchlist_now(user: dict = Depends(get_current_user)):
    if user["role"] != "staff":
        raise HTTPException(status_code=403, detail="staff only")
    try:
        return {"status": "success", **watchlist_service.check_watchlist_for_leader(_leader_of(user))}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/api/watchlist/{watchlist_id}")
def delete_watchlist(watchlist_id: int, user: dict = Depends(get_current_user)):
    if user["role"] != "staff":
        raise HTTPException(status_code=403, detail="staff only")
    ok = watchlist_service.delete_watchlist(_leader_of(user), watchlist_id)
    if not ok:
        raise HTTPException(status_code=404, detail="watchlist entry not found")
    return {"status": "success"}


# ── Top alerts ────────────────────────────────────────────────────────────

@router.get("/api/alerts/top5")
def alerts_top5(user: dict = Depends(get_current_user)):
    if user["role"] not in ("staff", "mla", "minister"):
        raise HTTPException(status_code=403, detail="staff or leader only")
    leaders = {l["username"]: l for l in user_repository.leaders_overview()}
    leader = leaders.get(user["username"]) or leaders.get(_leader_of(user))
    constituency = leader["constituency_name"] if leader else ""
    stories = top_alerts_service.top5_for_constituency(constituency)
    return {"status": "success", "stories": stories}


# ── Composed posts ────────────────────────────────────────────────────────

@router.get("/api/composed-posts")
def list_composed_posts(user: dict = Depends(get_current_user)):
    return {"status": "success", "posts": composed_posts_service.list_composed_posts(user)}


@router.post("/api/composed-posts")
def create_composed_post(payload: dict, user: dict = Depends(get_current_user)):
    if user["role"] != "staff":
        raise HTTPException(status_code=403, detail="staff drafts posts; leaders approve them")
    scheduled = payload.get("scheduled_at")
    if scheduled:
        try:
            datetime.fromisoformat(scheduled)
        except ValueError:
            raise HTTPException(status_code=422, detail="invalid scheduled_at")
    try:
        post = composed_posts_service.create_composed_post(
            user, payload.get("title", ""), payload.get("body", ""),
            payload.get("platforms") or [], scheduled, payload.get("image_data"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"status": "success", "post": post}


@router.patch("/api/composed-posts/{post_id}/status")
def decide_composed_post(post_id: int, payload: dict, user: dict = Depends(get_current_user)):
    if user["role"] not in ("mla", "minister"):
        raise HTTPException(status_code=403, detail="leaders approve office posts")
    status = payload.get("status")
    if status not in ("approved", "rejected"):
        raise HTTPException(status_code=422, detail="status must be approved or rejected")
    try:
        post = composed_posts_service.update_composed_post_status(user, post_id, status)
    except ValueError as exc:
        code = 404 if "not found" in str(exc) or "not your office" in str(exc) else 403
        raise HTTPException(status_code=code, detail=str(exc))
    return {"status": "success", "post": post}


# ── Project tracker ───────────────────────────────────────────────────────

@router.get("/api/projects")
def list_projects(user: dict = Depends(get_current_user)):
    return {"status": "success", "projects": project_tracker_service.list_projects(user)}


@router.post("/api/projects")
def create_project(payload: dict, user: dict = Depends(get_current_user)):
    if user["role"] != "staff":
        raise HTTPException(status_code=403, detail="staff only")
    project = project_tracker_service.create_project(
        user, payload.get("title", ""), payload.get("status", "active"),
        payload.get("milestones") or [], payload.get("photos") or [],
    )
    return {"status": "success", "project": project}


@router.patch("/api/projects/{project_id}")
def update_project(project_id: int, payload: dict, user: dict = Depends(get_current_user)):
    if user["role"] != "staff":
        raise HTTPException(status_code=403, detail="staff only")
    try:
        project = project_tracker_service.update_project(
            user, project_id, payload.get("title"), payload.get("status"),
            payload.get("milestones"), payload.get("photos"),
        )
    except ValueError as exc:
        code = 404 if "not found" in str(exc) else 403
        raise HTTPException(status_code=code, detail=str(exc))
    return {"status": "success", "project": project}


# ── Public survey ─────────────────────────────────────────────────────────

@router.post("/api/public-survey")
def public_survey(request: Request, payload: dict):
    client = request.client
    ip = client.host if client else "unknown"
    try:
        result = public_survey_service.submit_survey(
            ip,
            payload.get("role", ""),
            payload.get("category", ""),
            payload.get("message", ""),
            payload.get("name"),
            payload.get("email"),
            payload.get("leader"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400 if "rate" not in str(exc) else 429, detail=str(exc))
    return {"status": "success", "survey": result}


@router.get("/api/public-survey/results")
def survey_results(user: dict = Depends(get_current_user)):
    # An office sees only its own leader's responses. The master admin sees none (no access to citizens' messages).
    if user["role"] not in ("staff", "mla", "minister"):
        raise HTTPException(status_code=403, detail="forbidden")
    return {"status": "success", "leader": _leader_of(user), "responses": public_survey_service.list_responses(_leader_of(user))}


# ── Leader suggestions ────────────────────────────────────────────────────

@router.get("/api/leader/suggestions")
def leader_suggestions(user: dict = Depends(get_current_user)):
    if user["role"] not in ("mla", "minister"):
        raise HTTPException(status_code=403, detail="leaders only")
    return {"status": "success", "suggestions": leader_suggestions_service.build_suggestions(user["username"])}


@router.patch("/api/leader/suggestions/{suggestion_id}/approve")
def approve_suggestion(suggestion_id: int, payload: dict, user: dict = Depends(get_current_user)):
    if user["role"] not in ("mla", "minister"):
        raise HTTPException(status_code=403, detail="leaders only")
    assigned_to = (payload.get("assigned_to") or "").strip().lower() or None
    if assigned_to:
        active_staff = {s["username"].lower() for s in user_repository.list_staff_of(user["username"])}
        if assigned_to not in active_staff:
            raise HTTPException(status_code=422, detail="Choose an active staff member from your office.")
    result = leader_suggestions_service.approve_suggestion(user, suggestion_id, assigned_to)
    return {"status": "success", "suggestion": result}


# ── WhatsApp uploads ──────────────────────────────────────────────────────

@router.post("/api/whatsapp/upload")
def whatsapp_upload(payload: dict, user: dict = Depends(get_current_user)):
    if user["role"] != "staff":
        raise HTTPException(status_code=403, detail="staff only")
    result = whatsapp_service.upload_whatsapp(user, payload.get("raw_text", ""))
    return {"status": "success", "upload": result}


@router.get("/api/whatsapp/uploads")
def whatsapp_uploads(user: dict = Depends(get_current_user)):
    return {"status": "success", "uploads": whatsapp_service.list_uploads(user)}
