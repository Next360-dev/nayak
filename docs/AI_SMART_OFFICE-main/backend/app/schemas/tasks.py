"""
schemas/tasks.py - Pydantic models for constituency task responses.
"""

from pydantic import BaseModel


class TaskOut(BaseModel):
    id: str
    title: str
    department: str
    status: str
    priority: str
