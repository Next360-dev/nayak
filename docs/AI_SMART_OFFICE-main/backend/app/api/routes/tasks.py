"""
api/routes/tasks.py
GET  /api/tasks
POST /api/tasks/create
"""

from fastapi import APIRouter
from app.services import task_service

router = APIRouter()


@router.get("/api/tasks")
def get_tasks(constituency: str | None = None):
    tasks = task_service.get_tasks(constituency)
    return {"status": "success", "tasks": tasks}


@router.post("/api/tasks/create")
def create_task_endpoint(payload: dict):
    task = task_service.create_task(
        title=payload.get("title", ""),
        department=payload.get("department", "Constituency Cell"),
        priority=payload.get("priority", "High"),
    )
    return {"status": "success", "task": task}
