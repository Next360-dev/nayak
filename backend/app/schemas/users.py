"""
schemas/users.py - Pydantic models for user authentication.
"""

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(max_length=100)
    password: str = Field(max_length=200)
    client: str | None = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=1, max_length=500)


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class CreateUserRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(max_length=200)
    role: str = "mla"
    politician_name: str = ""
    constituency_name: str = ""
    district_name: str = ""
    mla_username: str | None = None


class ResetPasswordRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    new_password: str = Field(max_length=200)


class UserOut(BaseModel):
    username: str
    role: str
    politician_name: str
    constituency_name: str
    district_name: str
    scoped: bool = False
    can_share_to_anyone: bool = False


class LoginResponse(BaseModel):
    status: str
    token: str | None = None
    user: UserOut | None = None
    message: str | None = None


class TeamCreateRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(max_length=200)


class TeamActiveRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    active: bool


class SetActiveRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    active: bool


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(max_length=200)
    new_password: str = Field(max_length=200)
