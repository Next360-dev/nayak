"""
api/routes/devices.py
Device (push) token registration for the mobile app.

POST   /api/devices   register an Expo push token for the signed-in user
DELETE /api/devices   unregister a token owned by the signed-in user

Expo token format: ExponentPushToken[...]. Max 5 tokens per user.
"""

import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.repositories import user_repository
from app.services import auth_service

router = APIRouter()

_EXPO_TOKEN_RE = re.compile(r"^ExponentPushToken\[[^\]]+\]$")


class RegisterDeviceRequest(BaseModel):
    token: str = Field(min_length=1, max_length=500)
    platform: str | None = Field(default=None, max_length=50)


class UnregisterDeviceRequest(BaseModel):
    token: str = Field(min_length=1, max_length=500)


@router.post("/api/devices")
def register_device(payload: RegisterDeviceRequest, request: Request,
                    user: dict = Depends(get_current_user)):
    ip = request.client.host if request.client else "unknown"
    username = user["username"].strip().lower()
    if not auth_service.check_rate_limit(f"devices:{username}:{ip}", max_requests=30, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many requests. Try again later.")

    token = payload.token.strip()
    if not _EXPO_TOKEN_RE.match(token):
        raise HTTPException(status_code=422, detail="Invalid Expo push token format.")

    platform = (payload.platform or "unknown").strip() or "unknown"
    username = user["username"].strip().lower()

    existing_owner = user_repository.find_device_token_owner(token)
    if existing_owner is None or existing_owner.strip().lower() != username:
        if user_repository.count_device_tokens(username) >= 5:
            raise HTTPException(
                status_code=422, detail="Maximum of 5 device tokens per user."
            )

    user_repository.register_device_token(username, token, platform)
    return {"status": "success"}


@router.delete("/api/devices")
def unregister_device(
    request: Request,
    token: Optional[str] = Query(default=None),
    payload: Optional[UnregisterDeviceRequest] = None,
    user: dict = Depends(get_current_user),
):
    tok = (payload.token if payload else None) or token
    if not tok:
        raise HTTPException(status_code=422, detail="token is required.")
    tok = tok.strip()

    ip = request.client.host if request and request.client else "unknown"
    username = user["username"].strip().lower()
    if not auth_service.check_rate_limit(f"devices:{username}:{ip}", max_requests=30, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many requests. Try again later.")

    ok = user_repository.unregister_device_token(username, tok)
    if not ok:
        raise HTTPException(status_code=404, detail="Device token not found.")
    return {"status": "success"}
