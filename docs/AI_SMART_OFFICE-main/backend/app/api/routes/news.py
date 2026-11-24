"""
api/routes/news.py
GET  /api/news    - Main news feed (MLA scoped or admin)
GET  /api/health  - Health check endpoint
"""

from fastapi import APIRouter, Header
from app.services import news_service

router = APIRouter()


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
    x_user_role: str | None = Header(default=None),
    x_user_constituency: str | None = Header(default=None),
    x_user_district: str | None = Header(default=None),
    x_user_politician: str | None = Header(default=None),
):
    return news_service.get_news_feed(
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
        user_role=x_user_role,
        user_constituency=x_user_constituency,
        user_district=x_user_district,
        user_politician=x_user_politician,
    )


@router.get("/api/health")
def health():
    return {"status": "ok", "message": "AI Smart Office API is running smoothly"}
