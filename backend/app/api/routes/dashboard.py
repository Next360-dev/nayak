"""
api/routes/dashboard.py
GET /api/dashboard - the data for the caller's own HOME screen (shape depends on their role).
"""
from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.services import dashboard_service

router = APIRouter()


@router.get("/api/dashboard")
def dashboard(user: dict = Depends(get_current_user)):
    return dashboard_service.build(user)
