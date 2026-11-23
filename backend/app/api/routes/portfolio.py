"""Office-managed public portfolio content."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.repositories import portfolio_repository, user_repository

router = APIRouter()


class Milestone(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    date: str | None = Field(default=None, max_length=40)
    description: str = Field(default="", max_length=1200)


class Project(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    status: str = Field(default="In progress", max_length=60)
    location: str = Field(default="", max_length=180)
    description: str = Field(default="", max_length=1200)


class PortfolioContent(BaseModel):
    full_name: str = Field(default="", max_length=180)
    avatar_url: str = Field(default="", max_length=1000)
    title_en: str = Field(default="", max_length=240)
    title_te: str = Field(default="", max_length=240)
    biography_en: str = Field(default="", max_length=5000)
    biography_te: str = Field(default="", max_length=5000)
    constituency_office: str = Field(default="", max_length=500)
    ministerial_office: str = Field(default="", max_length=500)
    official_email: str = Field(default="", max_length=200)
    helpline: str = Field(default="", max_length=40)
    ministry_milestones: list[Milestone] = Field(default_factory=list, max_length=40)
    constituency_projects: list[Project] = Field(default_factory=list, max_length=60)


def _leader_username(user: dict) -> str:
    role = user.get("role")
    if role in ("mla", "minister"):
        return user["username"].lower()
    if role == "staff":
        leader = (user.get("mla_username") or "").strip().lower()
        if leader:
            return leader
        raise HTTPException(status_code=409, detail="This staff account is not linked to a leader.")
    raise HTTPException(status_code=403, detail="Portfolio access is limited to office teams.")


@router.get("/api/portfolio")
def get_portfolio(user: dict = Depends(get_current_user)):
    leader = _leader_username(user)
    saved = portfolio_repository.get_portfolio(leader)
    leader_user = user_repository.find_user_by_username(leader)
    return {"status": "success", "leader_username": leader,
            "leader_name": leader_user.get("politician_name") if leader_user else None,
            "content": (saved or {}).get("content", {}), "published": (saved or {}).get("published", False),
            "updated_by": (saved or {}).get("updated_by"), "updated_at": (saved or {}).get("updated_at")}


@router.get("/api/public/portfolio/{leader_username}")
def get_public_portfolio(leader_username: str):
    leader = user_repository.find_user_by_username(leader_username.strip().lower())
    if not leader or leader.get("role") not in ("mla", "minister"):
        raise HTTPException(status_code=404, detail="Portfolio not found.")
    saved = portfolio_repository.get_portfolio(leader["username"])
    if not saved or not saved.get("published"):
        raise HTTPException(status_code=404, detail="Portfolio has not been published.")
    return {"status": "success", "content": saved["content"]}


@router.put("/api/portfolio")
def put_portfolio(payload: PortfolioContent, user: dict = Depends(get_current_user)):
    if user.get("role") != "staff":
        raise HTTPException(status_code=403, detail="Only office staff can publish portfolio updates.")
    leader = _leader_username(user)
    content = payload.model_dump()
    if content["avatar_url"] and not content["avatar_url"].startswith(("https://", "http://")):
        raise HTTPException(status_code=422, detail="Avatar photo URL must start with http:// or https://.")
    if content["official_email"] and "@" not in content["official_email"]:
        raise HTTPException(status_code=422, detail="Enter a valid official email address.")
    result = portfolio_repository.save_portfolio(leader, user["username"], content)
    return {"status": "success", "leader_username": leader, **result}
