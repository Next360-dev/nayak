"""
api/routes/audit.py
GET /api/audit?limit=50&q=text&action=name - the audit log (who did what). Admin only.
"""
from fastapi import APIRouter, Depends

from app.api.deps import require_admin
from app.repositories import audit_repository

router = APIRouter()


@router.get("/api/audit")
def audit(limit: int = 50, q: str | None = None, action: str | None = None, admin: dict = Depends(require_admin)):
    return {"status": "success", "entries": audit_repository.recent(limit, q, action)}
