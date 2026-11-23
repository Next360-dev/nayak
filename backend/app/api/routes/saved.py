"""
api/routes/saved.py
A private reading list. Everyone only ever sees and changes their own saved stories.

GET    /api/saved          the caller's saved stories, newest first
POST   /api/saved          save a story (saving it twice is fine)
DELETE /api/saved/{id}     remove one of the caller's own saved stories
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.repositories import saved_repository

router = APIRouter()


class SaveStoryRequest(BaseModel):
    article_id: int | None = None
    title: str = Field(min_length=1, max_length=500)
    url: str | None = Field(default=None, max_length=2000)
    summary: str | None = Field(default=None, max_length=5000)
    place: str | None = Field(default=None, max_length=200)
    source: str | None = Field(default=None, max_length=200)
    tone: str | None = Field(default=None, max_length=30)
    published_at: datetime | None = None


@router.get("/api/saved")
def list_saved(user: dict = Depends(get_current_user)):
    return {"stories": saved_repository.list_for(user["username"].lower())}


@router.post("/api/saved")
def save_story(payload: SaveStoryRequest, user: dict = Depends(get_current_user)):
    key = saved_repository.story_key(payload.article_id, (payload.url or "").strip() or None)
    if key is None:
        raise HTTPException(status_code=422, detail="A story needs an article id or a link to be saved.")
    story = saved_repository.save(user["username"].lower(), key, payload.model_dump())
    return {"story": story}


@router.delete("/api/saved/{saved_id}")
def remove_saved(saved_id: int, user: dict = Depends(get_current_user)):
    if not saved_repository.remove(user["username"].lower(), saved_id):
        raise HTTPException(status_code=404, detail="Saved story not found.")
    return {"status": "success"}
