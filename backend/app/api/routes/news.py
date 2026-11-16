"""
api/routes/news.py
GET  /api/news    - Main news feed (MLA scoped or admin)
GET  /api/health  - Health check endpoint
"""

from app.core.ttl_cache import TTLCache
from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_current_user, is_scoped, require_roles
from app.repositories import audit_repository
from app.services import news_service
from app.services.refresh_service import latest_story_time, refresh_service

router = APIRouter()
_feed_cache = TTLCache()
FEED_TTL = 20  # seconds


@router.get("/api/news")
def get_news(
    district: str | None = None,
    constituency: str | None = None,
    politician: str | None = None,
    search: str | None = None,
    source_type: str | None = None,
    priority: int | None = None,
    date_range: str | None = None,
    specific_date: str | None = None,
    news_scope: str = "all",
    period: str = "today",
    page: int = 1,
    limit: int = 20,
    offset: int | None = None,
    user: dict = Depends(get_current_user),
):
    # Scope comes from the verified token, never from request headers.
    scoped = is_scoped(user)
    if scoped and user["constituency_name"] in ("All", ""):
        raise HTTPException(status_code=403, detail="Your account has no constituency assigned")
    key = ('feed', district, constituency, politician, search, source_type, priority, date_range, specific_date, news_scope, period, page, limit, offset, "mla" if scoped else user["role"], user["constituency_name"] if scoped else None, user["district_name"] if scoped else None, user["politician_name"] if scoped else None)
    return _feed_cache.get_or_compute(key, FEED_TTL, lambda: news_service.get_news_feed(
        district=district,
        constituency=constituency,
        politician=politician,
        search=search,
        source_type=source_type,
        priority=priority,
        date_range=date_range,
        specific_date=specific_date,
        news_scope=news_scope,
        period=period,
        page=page,
        limit=limit,
        offset=offset,
        user_role="mla" if scoped else user["role"],
        user_constituency=user["constituency_name"] if scoped else None,
        user_district=user["district_name"] if scoped else None,
        user_politician=user["politician_name"] if scoped else None,
    ))



# ── "Refresh news now" (the team does not have to wait for the 3-hour robot) ──
_can_refresh = require_roles("admin", "mla", "minister", "staff")


def _scope_of(user: dict) -> tuple[str, str | None, str | None]:
    """(cache key, constituency, district): a person with a constituency refreshes just that; others the whole state."""
    cons = user.get("constituency_name")
    key = refresh_service.scope_key(cons)
    district = user.get("district_name")
    return key, (cons if key != "*" else None), (district if key != "*" else None)


@router.get("/api/news/refresh/status")
def refresh_status(user: dict = Depends(_can_refresh)):
    key, cons, _ = _scope_of(user)
    return {"status": "success", **refresh_service.status(key), "scope": cons or "Telangana", "latest_story_at": latest_story_time(cons)}


@router.post("/api/news/refresh")
def refresh_now(user: dict = Depends(_can_refresh)):
    key, cons, district = _scope_of(user)
    out = refresh_service.start(key, cons, district, on_done=_feed_cache.clear)
    if out.get("started"):
        audit_repository.log("news_refresh", actor=user["username"], target=cons or "Telangana", detail={"scope": key})
    return {"status": "success", **out, "scope": cons or "Telangana", "latest_story_at": latest_story_time(cons)}
