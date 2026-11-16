"""
api/routes/feedback.py
POST /api/feedback/story   any logged-in user: "not relevant" / "wrong priority" / "wrong tone" on a story
POST /api/feedback/app     any logged-in user: free text about the app (used during the pilot)
Admins see the summary on the Control Room (GET /api/dashboard).
"""
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.repositories import audit_repository, feedback_repository

router = APIRouter()


class StoryFeedback(BaseModel):
    article_id: int | None = None
    title: str = Field(min_length=1, max_length=500)
    kind: Literal["not_relevant", "wrong_priority", "wrong_sentiment"]
    note: str | None = Field(default=None, max_length=500)


class AppFeedback(BaseModel):
    message: str = Field(min_length=3, max_length=2000)


@router.post("/api/feedback/story")
def story_feedback(payload: StoryFeedback, user: dict = Depends(get_current_user)):
    new = feedback_repository.add_story_feedback(payload.article_id, payload.title, payload.kind, payload.note, user["username"])
    if new:
        audit_repository.log("story_feedback", actor=user["username"], target=str(payload.article_id or ""), detail={"kind": payload.kind})
    return {"status": "success", "recorded": new}


@router.post("/api/feedback/app")
def app_feedback(payload: AppFeedback, user: dict = Depends(get_current_user)):
    feedback_repository.add_app_feedback(user["username"], payload.message)
    audit_repository.log("app_feedback", actor=user["username"])
    return {"status": "success"}
