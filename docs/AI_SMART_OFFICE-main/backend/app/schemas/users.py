"""
schemas/users.py - Pydantic models for user authentication responses.
"""

from pydantic import BaseModel


class UserOut(BaseModel):
    username: str
    role: str
    politician_name: str
    constituency_name: str
    district_name: str


class LoginResponse(BaseModel):
    status: str
    user: UserOut | None = None
    message: str | None = None
