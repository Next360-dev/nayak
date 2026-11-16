"""
api/routes/account.py - my own contact details, alert switch, briefing and a test email.

GET  /api/me/profile        my email / phone / alerts / language (+ whether the server can send email at all)
PUT  /api/me/profile        change them
GET  /api/briefing          today's briefing for ME (?lang=en|te); copy-and-paste friendly
POST /api/briefing/email-me email today's briefing to my own address now
POST /api/me/test-alert     email a short test message to my own address (checks the server's email setup)
"""
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.repositories import audit_repository, user_repository
from app.services import briefing_service, notify_service

router = APIRouter()
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^\+?[0-9][0-9 \-]{6,17}[0-9]$")


class ProfileRequest(BaseModel):
    email: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    alerts_enabled: bool = True
    lang: str = "en"


def _profile(user: dict) -> dict:
    c = user_repository.contact_of(user["username"]) or {}
    return {"email": c.get("email"), "phone": c.get("phone"), "alerts_enabled": c.get("alerts_enabled", True),
            "lang": c.get("lang", "en"), "email_configured": notify_service.email_configured()}


@router.get("/api/me/profile")
def get_profile(user: dict = Depends(get_current_user)):
    return {"status": "success", **_profile(user)}


@router.put("/api/me/profile")
def put_profile(payload: ProfileRequest, user: dict = Depends(get_current_user)):
    email = (payload.email or "").strip() or None
    phone = (payload.phone or "").strip() or None
    if email and not EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="That email address does not look right.")
    if phone and not PHONE_RE.match(phone):
        raise HTTPException(status_code=422, detail="Phone must be digits, optionally starting with +.")
    if payload.lang not in ("en", "te"):
        raise HTTPException(status_code=422, detail="Language must be en or te.")
    user_repository.set_profile(user["username"], email, phone, payload.alerts_enabled, payload.lang)
    audit_repository.log("profile_updated", actor=user["username"], target=user["username"],
                         detail={"email_set": bool(email), "alerts": payload.alerts_enabled, "lang": payload.lang})
    return {"status": "success", **_profile(user)}


@router.get("/api/briefing")
def my_briefing(lang: str = "en", user: dict = Depends(get_current_user)):
    return {"status": "success", **briefing_service.build(user, lang)}


def _require_email_ready(user: dict) -> dict:
    if not notify_service.email_configured():
        raise HTTPException(status_code=409, detail="Email is not set up on the server yet (SMTP_HOST and SMTP_FROM).")
    c = user_repository.contact_of(user["username"])
    if not c or not c["email"]:
        raise HTTPException(status_code=422, detail="Add your email address first.")
    return c


@router.post("/api/briefing/email-me")
def email_me_briefing(lang: str = "en", user: dict = Depends(get_current_user)):
    c = _require_email_ready(user)
    b = briefing_service.build(user, lang)
    result = notify_service.deliver("briefing_manual", b["title"], user["username"], b["title"], b["text"], force=True)
    if result != "sent":
        raise HTTPException(status_code=502, detail="The email could not be sent. Check the server's email settings.")
    return {"status": "success", "sent_to": c["email"]}


@router.post("/api/me/test-alert")
def test_alert(user: dict = Depends(get_current_user)):
    c = _require_email_ready(user)
    result = notify_service.deliver("test", "manual", user["username"], "Nayak test message",
                                    "If you can read this, alerts and the daily briefing will reach you.", force=True)
    if result != "sent":
        raise HTTPException(status_code=502, detail="The email could not be sent. Check the server's email settings.")
    return {"status": "success", "sent_to": c["email"]}
