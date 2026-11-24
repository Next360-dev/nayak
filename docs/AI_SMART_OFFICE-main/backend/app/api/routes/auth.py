"""
api/routes/auth.py
POST /api/login
POST /api/users/create
"""

from fastapi import APIRouter
from app.services import auth_service
from app.repositories import user_repository

router = APIRouter()


@router.post("/api/login")
def login(payload: dict):
    username = payload.get("username", "").strip().lower()
    password = payload.get("password", "")

    user = auth_service.authenticate(username, password)
    if user:
        return {"status": "success", "user": user}
    return {"status": "error", "message": "Invalid credentials"}


@router.post("/api/users/create")
def create_user_endpoint(payload: dict):
    new_user = user_repository.create_user(
        username=payload.get("username", ""),
        password_raw=payload.get("password", ""),
        politician_name=payload.get("politician_name", ""),
        constituency_name=payload.get("constituency_name", ""),
        district_name=payload.get("district_name", ""),
        role=payload.get("role", "mla"),
    )
    return {"status": "success", "user": new_user}
