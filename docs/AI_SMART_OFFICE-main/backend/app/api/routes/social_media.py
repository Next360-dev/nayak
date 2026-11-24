"""
api/routes/social_media.py
Social Media monitoring endpoints for MLAs across:
  - Instagram (📷)
  - Twitter / X (🐦)
  - YouTube (▶️)
  - Facebook (📘)

GET  /api/social_media         - Main feed of social posts with positive/negative sentiment breakdown
POST /api/social_media/scrape  - Trigger on-demand scraping across social platforms for an MLA
GET  /api/social_media/stats   - Summary metrics for the individual MLA
"""

from fastapi import APIRouter, Query
from typing import Optional
from app.services import social_media_service

router = APIRouter()


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
):
    """
    Returns social media posts scraped for the MLA from Instagram, Twitter, YouTube, and Facebook,
    categorized into Positive and Negative posts.
    """
    return social_media_service.get_social_feed(
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


@router.post("/api/social_media/scrape")
def trigger_scrape(
    constituency: str = Query(..., description="Constituency name, e.g. Kodangal"),
    mla_name: Optional[str] = Query(default=None, description="MLA name"),
):
    """
    Triggers live scraping from Instagram, Twitter, YouTube, and Facebook for the MLA.
    """
    return social_media_service.trigger_social_media_scrape(
        constituency=constituency,
        mla_name=mla_name
    )


@router.get("/api/social_media/stats")
def get_social_media_stats(
    constituency: Optional[str] = None,
    mla_name: Optional[str] = None,
    period: str = "today"
):
    """
    Quick endpoint returning total, positive, negative, and platform counts for the MLA.
    """
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
