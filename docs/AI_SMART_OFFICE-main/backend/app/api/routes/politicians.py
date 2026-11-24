"""
api/routes/politicians.py
GET /api/politicians
GET /api/representatives
GET /api/hierarchy
"""

from fastapi import APIRouter
from app.repositories import politician_repository

router = APIRouter()


@router.get("/api/hierarchy")
def get_hierarchy():
    data = politician_repository.fetch_hierarchy()
    return {"status": "success", "data": data}


@router.get("/api/politicians")
@router.get("/api/representatives")
def get_politicians(district: str | None = None, constituency: str | None = None):
    reps = politician_repository.fetch_politicians(district, constituency)
    return {"status": "success", "politicians": reps, "representatives": reps}
