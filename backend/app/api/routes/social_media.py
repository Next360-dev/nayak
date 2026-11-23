"""
api/routes/social_media.py
Social Media monitoring endpoints for MLAs across:
  - Instagram (📷)
  - Twitter / X (🐦)
  - YouTube (▶️)
  - Facebook (📘)

GET  /api/social_media         - Main feed of social posts with positive/negative sentiment breakdown.
                                 Starts a background refresh when the data is older than 3 hours (`refreshing: true`).
POST /api/social_media/scrape  - Trigger on-demand scraping across social platforms for an MLA
GET  /api/social_media/stats   - Summary metrics for the individual MLA
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from app.api.deps import get_current_user, is_scoped, require_roles
from app.services import social_media_service

router = APIRouter()


def _apply_scope(user, constituency, mla_name, district):
    """MLAs and staff are pinned to their own constituency; query params cannot widen it."""
    if is_scoped(user):
        if user["constituency_name"] in ("All", ""):
            raise HTTPException(status_code=403, detail="Your account has no constituency assigned")
        return user["constituency_name"], user["politician_name"], user["district_name"]
    return constituency, mla_name, district


@router.get("/api/social_media")
def get_social_media_feed(
    constituency: Optional[str] = None,
    mla_name: Optional[str] = None,
    district: Optional[str] = None,
    platform: Optional[str] = None,
    sentiment: Optional[str] = None,
    period: str = "today",
    search: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(get_current_user),
):
    """
    Returns social media posts scraped for the MLA from Instagram, Twitter, YouTube, and Facebook,
    categorized into Positive and Negative posts.
    """
    constituency, mla_name, district = _apply_scope(user, constituency, mla_name, district)
    refreshing = social_media_service.kick_crawl_if_stale(constituency, mla_name)
    feed = social_media_service.get_social_feed(
        constituency=constituency,
        mla_name=mla_name,
        district=district,
        platform=platform,
        sentiment=sentiment,
        period=period,
        search=search,
        limit=limit,
        offset=offset,
    )
    feed["refreshing"] = refreshing  # true while a background crawl is running: the app re-checks shortly
    return feed


@router.post("/api/social_media/scrape")
def trigger_scrape(
    constituency: str = Query(..., description="Constituency name, e.g. Kodangal"),
    mla_name: Optional[str] = Query(default=None, description="MLA name"),
    user: dict = Depends(require_roles("admin", "mla", "minister", "staff")),
):
    """
    Triggers live scraping from Instagram, Twitter, YouTube, and Facebook for the MLA.
    """
    constituency, mla_name, _ = _apply_scope(user, constituency, mla_name, None)
    return social_media_service.trigger_social_media_scrape(
        constituency=constituency,
        mla_name=mla_name
    )


@router.get("/api/social_media/stats")
def get_social_media_stats(
    constituency: Optional[str] = None,
    mla_name: Optional[str] = None,
    period: str = "today",
    user: dict = Depends(get_current_user),
):
    """
    Quick endpoint returning total, positive, negative, and platform counts for the MLA.
    """
    constituency, mla_name, _ = _apply_scope(user, constituency, mla_name, None)
    res = social_media_service.get_social_feed(
        constituency=constituency,
        mla_name=mla_name,
        period=period,
        limit=1
    )
    return {
        "status": "success",
        "mla": res.get("mla"),
        "stats": res.get("stats")
    }
