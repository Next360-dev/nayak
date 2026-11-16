"""
api/routes/auth.py
POST /api/login          - username + password -> JWT
GET  /api/me             - current user (validates a stored token)
POST /api/me/password    - any logged-in user changes their OWN password (ends all other sessions)
POST /api/users/create   - admin only
POST /api/users/reset-password - admin only
GET  /api/users          - admin only: every account (support view)
POST /api/users/set-active - admin only: disable / enable a non-admin account
"""

from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.deps import get_current_user, require_admin
from app.schemas.users import (
    CreateUserRequest, LoginRequest, LogoutRequest, RefreshTokenRequest, ResetPasswordRequest, SetActiveRequest, ChangePasswordRequest,
)
from app.core.security import MIN_PASSWORD_LENGTH, hash_password
from app.services import auth_service
from app.core.security import create_access_token, verify_password
from app.repositories import audit_repository, user_repository

router = APIRouter()


@router.post("/api/login")
def login(payload: LoginRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    throttle_key = f"{payload.username.strip().lower()}|{client_ip}"

    if auth_service.is_locked_out(throttle_key):
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")

    user, token = auth_service.authenticate(payload.username, payload.password, throttle_key)
    if not user:
        return {"status": "error", "message": "Invalid credentials"}
    resp = {"status": "success", "token": token, "user": auth_service.public_user(user)}
    if payload.client == "mobile":
        resp["refresh_token"] = auth_service.issue_refresh_token(user["username"])
    return resp


@router.get("/api/me")
def me(user: dict = Depends(get_current_user)):
    return {"status": "success", "user": auth_service.public_user(user)}


@router.post("/api/me/password")
def change_my_password(payload: ChangePasswordRequest, request: Request, user: dict = Depends(get_current_user)):
    ip = request.client.host if request.client else "unknown"
    # guessing the current password through this screen is rate limited too
    if not auth_service.check_rate_limit(f"pw:{user['username']}", max_requests=5, window_seconds=15 * 60):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")
    _, stored_hash = user_repository.find_user_with_hash(user["username"])
    if not verify_password(payload.current_password, stored_hash):
        audit_repository.log("password_change_failed", actor=user["username"], target=user["username"], ip=ip)
        raise HTTPException(status_code=403, detail="Current password is wrong.")
    if len(payload.new_password or "") < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=422, detail=f"New password must be at least {MIN_PASSWORD_LENGTH} characters.")
    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=422, detail="New password must be different from the current one.")
    user_repository.set_password_hash(user["username"], hash_password(payload.new_password))
    auth_service.revoke_all_refresh_tokens_for_user(user["username"])
    audit_repository.log("password_changed", actor=user["username"], target=user["username"], ip=ip)
    # every OTHER session is now invalid; hand back a fresh token so this one keeps working
    return {"status": "success", "token": create_access_token(user["username"])}


@router.post("/api/token/refresh")
def token_refresh(payload: RefreshTokenRequest, request: Request):
    ip = request.client.host if request.client else "unknown"
    if not auth_service.check_rate_limit(f"refresh:{ip}", max_requests=30, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many requests. Try again later.")
    access, new_refresh, err = auth_service.refresh_access_token(payload.refresh_token)
    if err:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    return {"status": "success", "token": access, "refresh_token": new_refresh}


@router.post("/api/logout")
def logout(payload: LogoutRequest | None = None, user: dict = Depends(get_current_user)):
    if payload and payload.refresh_token:
        auth_service.revoke_refresh_token(payload.refresh_token)
    else:
        auth_service.revoke_all_refresh_tokens_for_user(user["username"])
    return {"status": "success"}


@router.post("/api/users/create")
def create_user_endpoint(payload: CreateUserRequest, admin: dict = Depends(require_admin)):
    error = auth_service.validate_new_user(
        payload.username, payload.password, payload.role, payload.mla_username
    )
    if error:
        raise HTTPException(status_code=422, detail=error)
    if user_repository.find_user_by_username(payload.username):
        raise HTTPException(status_code=409, detail="Username already exists")

    audit_repository.log("user_created", actor=admin["username"], target=payload.username.strip().lower(), detail={"role": payload.role})
    new_user = auth_service.create_user(
        username=payload.username,
        password=payload.password,
        politician_name=payload.politician_name,
        constituency_name=payload.constituency_name,
        district_name=payload.district_name,
        role=payload.role,
        mla_username=payload.mla_username,
    )
    return {"status": "success", "user": auth_service.public_user(new_user)}


@router.post("/api/users/reset-password")
def reset_password_endpoint(payload: ResetPasswordRequest, admin: dict = Depends(require_admin)):
    if len(payload.new_password or "") < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=422, detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters.")
    target = user_repository.find_user_by_username(payload.username)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    user_repository.set_password_hash(payload.username, hash_password(payload.new_password))
    # Sign the user out of every mobile/refresh session; they must log in with the new password.
    auth_service.revoke_all_refresh_tokens_for_user(payload.username)
    audit_repository.log("password_reset", actor=admin["username"], target=payload.username.strip().lower())
    return {"status": "success", "username": payload.username.strip().lower()}


@router.get("/api/users")
def list_users_endpoint(admin: dict = Depends(require_admin)):
    return {"status": "success", "users": user_repository.list_all_users()}


@router.post("/api/users/set-active")
def set_user_active_endpoint(payload: SetActiveRequest, admin: dict = Depends(require_admin)):
    role = user_repository.role_of_any(payload.username)
    if role is None:
        raise HTTPException(status_code=404, detail="User not found")
    if role == "admin":
        raise HTTPException(status_code=403, detail="Admin accounts cannot be disabled here (prevents locking everyone out).")
    user_repository.set_active(payload.username, payload.active)
    if not payload.active:
        auth_service.revoke_all_refresh_tokens_for_user(payload.username)
    audit_repository.log("user_disabled" if not payload.active else "user_enabled", actor=admin["username"], target=payload.username.strip().lower())
    return {"status": "success", "username": payload.username.strip().lower(), "active": payload.active}
