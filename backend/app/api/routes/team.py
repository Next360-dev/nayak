"""
api/routes/team.py
GET  /api/admin/overview      - master admin control room: leaders' activity + system health (admin only)
GET  /api/team                - an MLA/minister lists their own staff
POST /api/team/create         - create a staff user for yourself (role is always 'staff')
POST /api/team/reset-password - reset one of YOUR staff's passwords
POST /api/team/set-active     - disable / re-enable one of YOUR staff

An MLA or minister can only ever touch staff linked to their own username. Everything else is a 404,
so one leader cannot even learn whether another leader's staff exist.
"""

import psycopg2.errors
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_admin, require_roles
from app.core.security import MIN_PASSWORD_LENGTH, hash_password
from app.repositories import audit_repository, user_repository
from app.schemas.users import ResetPasswordRequest, TeamActiveRequest, TeamCreateRequest
from app.services import auth_service, dashboard_service

router = APIRouter()

require_leader = require_roles("mla", "minister")


@router.get("/api/admin/overview")
def admin_overview(admin: dict = Depends(require_admin)):
    leaders = user_repository.leaders_overview()
    return {
        "status": "success",
        "system": dashboard_service.system_health(),
        "leaders": leaders,
        "totals": {
            "leaders": len(leaders),
            "never_logged_in": sum(1 for x in leaders if not x["last_login"]),
            "unseen_shares": sum(x["shares"]["new"] for x in leaders),
        },
    }


@router.get("/api/team")
def my_team(leader: dict = Depends(require_leader)):
    return {"status": "success", "staff": user_repository.list_staff_of(leader["username"])}


@router.post("/api/team/create")
def create_staff(payload: TeamCreateRequest, leader: dict = Depends(require_leader)):
    error = auth_service.validate_new_user(payload.username, payload.password, "staff", leader["username"])
    if error:
        raise HTTPException(status_code=422, detail=error)
    if user_repository.find_user_by_username(payload.username):
        raise HTTPException(status_code=409, detail="Username already exists")
    try:
        auth_service.create_user(
            username=payload.username, password=payload.password,
            politician_name="", constituency_name="", district_name="",  # staff inherit these from their leader
            role="staff", mla_username=leader["username"],
        )
    except psycopg2.errors.UniqueViolation:  # e.g. a disabled account already uses this username
        raise HTTPException(status_code=409, detail="Username already exists")
    audit_repository.log("user_created", actor=leader["username"], target=payload.username.strip().lower(), detail={"role": "staff"})
    return {"status": "success", "username": payload.username.strip().lower()}


def _own_staff_or_404(leader: dict, username: str) -> None:
    if not user_repository.is_staff_of(leader["username"], username):
        raise HTTPException(status_code=404, detail="Staff member not found")


@router.post("/api/team/reset-password")
def reset_staff_password(payload: ResetPasswordRequest, leader: dict = Depends(require_leader)):
    if len(payload.new_password or "") < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=422, detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters.")
    _own_staff_or_404(leader, payload.username)
    user_repository.set_password_hash(payload.username, hash_password(payload.new_password))
    user_repository.set_must_change_password(payload.username, True)
    auth_service.revoke_all_refresh_tokens_for_user(payload.username)
    audit_repository.log("password_reset", actor=leader["username"], target=payload.username.strip().lower())
    return {"status": "success", "username": payload.username.strip().lower()}


@router.post("/api/team/set-active")
def set_staff_active(payload: TeamActiveRequest, leader: dict = Depends(require_leader)):
    _own_staff_or_404(leader, payload.username)
    user_repository.set_active(payload.username, payload.active)
    if not payload.active:
        auth_service.revoke_all_refresh_tokens_for_user(payload.username)
    audit_repository.log("user_disabled" if not payload.active else "user_enabled", actor=leader["username"], target=payload.username.strip().lower())
    return {"status": "success", "username": payload.username.strip().lower(), "active": payload.active}
