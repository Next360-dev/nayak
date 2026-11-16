"""
api/deps.py - FastAPI dependencies for authentication and role checks.

The caller's identity comes ONLY from the signed Bearer token. Role and scope
are re-read from the database on every request; request headers such as
X-User-Role are never trusted.
"""

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_access_token_full
from app.repositories import user_repository
from app.services import auth_service

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    decoded = decode_access_token_full(creds.credentials)
    if not decoded:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    username, issued_at = decoded
    user = user_repository.find_user_by_username(username)
    if not user:
        raise HTTPException(status_code=401, detail="User no longer active")
    changed = user.get("password_changed_at")
    if changed is not None and issued_at < changed.timestamp():
        raise HTTPException(status_code=401, detail="Password changed. Please log in again.")
    return user


def require_roles(*roles: str):
    def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Not allowed for your role")
        return user
    return checker


require_admin = require_roles("admin")


def is_scoped(user: dict) -> bool:
    """True when the user may only see their own constituency (see auth_service.is_scoped)."""
    return auth_service.is_scoped(user)


def inbox_owner(user: dict) -> str:
    """Whose inbox this user reads: always their own (staff and leaders share to each other)."""
    return user["username"].lower()
