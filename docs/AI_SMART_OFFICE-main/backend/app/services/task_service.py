"""
services/task_service.py
Thin service layer for constituency tasks.
Currently just delegates to the repository.
Business rules (e.g. assigning tasks to specific officers) go here.
"""

from app.repositories import task_repository


def get_tasks(constituency: str | None = None):
    return task_repository.fetch_tasks(constituency)


def create_task(title: str, department: str, priority: str = "High"):
    return task_repository.insert_task(title, department, priority)
