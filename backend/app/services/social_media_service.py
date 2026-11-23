"""
services/social_media_service.py
Business orchestration service for Social Media monitoring across:
  - Instagram (📷)
  - Twitter / X (🐦)
  - YouTube (▶️)
  - Facebook (📘)

Provides positive vs negative sentiment aggregation and post feeds for individual MLAs.
"""

import logging
import os
import re
import threading
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from app.core.database import get_connection
from data.constituency_mappings import get_canonical_district, get_mla_for_constituency, ALL_119_MLAS
from social_media_scraper import (
    scrape_social_media_for_mla,
    save_social_posts_to_db,
)

PLATFORM_META = {
    "twitter": {
        "name": "Twitter / X",
        "icon": "🐦",
        "color": "#0f1419",
        "badge_class": "badge-twitter",
        "action_label": "View Tweet on X"
    },
    "youtube": {
        "name": "YouTube",
        "icon": "▶️",
        "color": "#FF0000",
        "badge_class": "badge-youtube",
        "action_label": "Watch on YouTube"
    },
    "facebook": {
        "name": "Facebook",
        "icon": "📘",
        "color": "#1877F2",
        "badge_class": "badge-facebook",
        "action_label": "View Post on Facebook"
    },
    "instagram": {
        "name": "Instagram",
        "icon": "📷",
        "color": "#E1306C",
        "badge_class": "badge-instagram",
        "action_label": "View on Instagram"
    }
}


def _format_relative_time(dt_val) -> str:
    """Formats a datetime into a human-friendly relative time string."""
    if not dt_val:
        return "Recently"
    if isinstance(dt_val, str):
        try:
            from email.utils import parsedate_to_datetime
            dt = parsedate_to_datetime(dt_val)
        except Exception:
            try:
                dt = datetime.fromisoformat(dt_val.replace("Z", "+00:00"))
            except Exception:
                return "Recently"
    else:
        dt = dt_val

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    diff = now - dt
    total_seconds = int(diff.total_seconds())

    if total_seconds < 60:
        return "Just now"
    elif total_seconds < 3600:
        mins = total_seconds // 60
        return f"{mins}m ago"
    elif total_seconds < 86400:
        hrs = total_seconds // 3600
        return f"{hrs}h ago"
    elif total_seconds < 172800:
        return "Yesterday"
    else:
        days = total_seconds // 86400
        return f"{days}d ago"


# ── automatic background refresh ─────────────────────────────────────────────
# Opening the social feed shows what is stored straight away. If this constituency has not been crawled
# recently, one background crawl starts (never two at once) and the feed says `refreshing: true`
# so the app can show the new posts as soon as they land. Nobody has to press a button.
log = logging.getLogger(__name__)
CRAWL_STALE_SECONDS = 3 * 3600
CRAWL_RETRY_AFTER_FAILURE_SECONDS = 15 * 60
MANUAL_COOLDOWN_SECONDS = 120      # the Refresh button cannot hammer Google (and get this server blocked)
MAX_CONCURRENT_CRAWLS = 3
_crawl_lock = threading.Lock()
_crawling: set[str] = set()
_last_crawl: dict[str, float] = {}


def _crawl_key(constituency: str) -> str:
    return re.sub(r"\s*\((SC|ST)\)", "", constituency or "").strip().lower()


def is_crawling(constituency: Optional[str]) -> bool:
    return bool(constituency) and _crawl_key(constituency) in _crawling


def _run_crawl(constituency: str, mla_name: Optional[str], key: str) -> None:
    ok = False
    try:
        trigger_social_media_scrape(constituency, mla_name, force=True)
        ok = True
    except Exception:
        log.exception("background social crawl failed for %s", constituency)
    finally:
        with _crawl_lock:
            _crawling.discard(key)
            # a failure is retried sooner than a success
            _last_crawl[key] = time.time() - (0 if ok else CRAWL_STALE_SECONDS - CRAWL_RETRY_AFTER_FAILURE_SECONDS)


def kick_crawl_if_stale(constituency: Optional[str], mla_name: Optional[str]) -> bool:
    """Start a background crawl when this constituency's data is old. Returns True if one is running now."""
    if not constituency or constituency in ("All", "All Assembly Constituencies", "All Constituencies", "Statewide"):
        return False
    key = _crawl_key(constituency)
    with _crawl_lock:
        if key in _crawling:
            return True
        if len(_crawling) >= MAX_CONCURRENT_CRAWLS:
            return False
        if os.getenv("SOCIAL_AUTO_CRAWL", "1") == "0":
            return False
        if time.time() - _last_crawl.get(key, 0) < CRAWL_STALE_SECONDS:
            return False
        _crawling.add(key)
    threading.Thread(target=_run_crawl, args=(constituency, mla_name, key), name=f"social-crawl-{key}", daemon=True).start()
    return True


def get_social_feed(
    *,
    constituency: Optional[str] = None,
    mla_name: Optional[str] = None,
    district: Optional[str] = None,
    platform: Optional[str] = None,
    sentiment: Optional[str] = None,
    period: str = "today",
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """
    Main business method for retrieving social media news and posts for an MLA.
    Applies filtering by MLA/constituency, platform, sentiment (positive/negative), and period.
    """
    # Clean filters
    if constituency in ("All", "All Assembly Constituencies", "All Constituencies", "Statewide"):
        constituency = None
    if district in ("All", "All 33 Districts", "All Districts", "Statewide"):
        district = None
    if mla_name in ("All", "All Leaders", "State Administration", "State Master Administrator", "Master Admin", "All 119 MLAs & CM", "Constituency Representative"):
        mla_name = None

    active_mla = None
    if constituency:
        mla_info = get_mla_for_constituency(constituency)
        if mla_info:
            active_mla = mla_info
            if not mla_name:
                mla_name = mla_info.get("name")
        if not district:
            district = get_canonical_district(constituency)
    elif mla_name:
        mla_clean = mla_name.lower().strip()
        for c_k, m_info in ALL_119_MLAS.items():
            candidate_names = [m_info["name"].lower()] + [a.lower() for a in m_info.get("aliases", [])]
            if any(mla_clean in cand or cand in mla_clean for cand in candidate_names):
                constituency = c_k
                active_mla = m_info
                district = m_info.get("district")
                break

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Build query
            where_clauses = ["1=1"]
            params = []

            if constituency:
                const_clean = re.sub(r"\s*\((SC|ST)\)", "", constituency).strip()
                where_clauses.append("(constituency ILIKE %s OR constituency ILIKE %s OR mla_name ILIKE %s)")
                params.extend([f"%{constituency}%", f"%{const_clean}%", f"%{mla_name}%" if mla_name else f"%{const_clean}%"])
            elif district:
                where_clauses.append("district ILIKE %s")
                params.append(f"%{district}%")
            elif mla_name:
                where_clauses.append("mla_name ILIKE %s")
                params.append(f"%{mla_name}%")

            if platform and platform.lower() not in ("all", "all platforms"):
                where_clauses.append("platform = %s")
                params.append(platform.lower().strip())

            if sentiment and sentiment.lower() in ("positive", "negative"):
                where_clauses.append("sentiment = %s")
                params.append(sentiment.lower().strip())

            if search and search.strip():
                where_clauses.append("(content ILIKE %s OR author_name ILIKE %s OR author_handle ILIKE %s)")
                s_param = f"%{search.strip()}%"
                params.extend([s_param, s_param, s_param])

            if period == "today":
                where_clauses.append("published_at >= NOW() - INTERVAL '24 hours'")
            elif period == "history":
                where_clauses.append("published_at < NOW() - INTERVAL '24 hours'")

            where_sql = " AND ".join(where_clauses)

            # 1. Fetch statistics
            stats_sql = f"""
            SELECT
                COUNT(*) AS total_count,
                COUNT(*) FILTER (WHERE sentiment = 'positive') AS pos_count,
                COUNT(*) FILTER (WHERE sentiment = 'negative') AS neg_count,
                COUNT(*) FILTER (WHERE platform = 'twitter') AS twitter_count,
                COUNT(*) FILTER (WHERE platform = 'youtube') AS youtube_count,
                COUNT(*) FILTER (WHERE platform = 'facebook') AS facebook_count,
                COUNT(*) FILTER (WHERE platform = 'instagram') AS instagram_count,
                COUNT(*) FILTER (WHERE sentiment = 'neutral') AS neutral_count
            FROM social_media_posts
            WHERE {where_sql};
            """
            cur.execute(stats_sql, tuple(params))
            stats_row = cur.fetchone()

            total_cnt = stats_row[0] or 0
            pos_cnt = stats_row[1] or 0
            neg_cnt = stats_row[2] or 0
            neutral_cnt = stats_row[7] or 0
            plat_counts = {
                "twitter": stats_row[3] or 0,
                "youtube": stats_row[4] or 0,
                "facebook": stats_row[5] or 0,
                "instagram": stats_row[6] or 0
            }

            # If today has 0 results, fall back to older posts so the screen is not empty, and SAY so (`showing_older`).
            showing_older = False
            if total_cnt == 0 and period == "today":
                fallback_where = [w for w in where_clauses if "INTERVAL '24 hours'" not in w]
                fallback_where_sql = " AND ".join(fallback_where)
                fb_stats_sql = f"""
                SELECT
                    COUNT(*) AS total_count,
                    COUNT(*) FILTER (WHERE sentiment = 'positive') AS pos_count,
                    COUNT(*) FILTER (WHERE sentiment = 'negative') AS neg_count,
                    COUNT(*) FILTER (WHERE platform = 'twitter') AS twitter_count,
                    COUNT(*) FILTER (WHERE platform = 'youtube') AS youtube_count,
                    COUNT(*) FILTER (WHERE platform = 'facebook') AS facebook_count,
                    COUNT(*) FILTER (WHERE platform = 'instagram') AS instagram_count,
                    COUNT(*) FILTER (WHERE sentiment = 'neutral') AS neutral_count
                FROM social_media_posts
                WHERE {fallback_where_sql};
                """
                cur.execute(fb_stats_sql, tuple(params))
                fb_row = cur.fetchone()
                if fb_row and fb_row[0] > 0:
                    where_sql = fallback_where_sql
                    total_cnt = fb_row[0] or 0
                    pos_cnt = fb_row[1] or 0
                    neg_cnt = fb_row[2] or 0
                    neutral_cnt = fb_row[7] or 0
                    showing_older = True
                    plat_counts = {
                        "twitter": fb_row[3] or 0,
                        "youtube": fb_row[4] or 0,
                        "facebook": fb_row[5] or 0,
                        "instagram": fb_row[6] or 0
                    }

            # 2. Fetch posts
            query_sql = f"""
            SELECT
                id, platform, post_id, mla_name, constituency, district,
                author_handle, author_name, content, url, media_url,
                likes_count, shares_count, comments_count, views_count,
                sentiment, sentiment_reason, published_at
            FROM social_media_posts
            WHERE {where_sql}
            ORDER BY published_at DESC, id DESC
            LIMIT %s OFFSET %s;
            """
            cur.execute(query_sql, tuple(params + [limit, offset]))
            rows = cur.fetchall()

            posts = []
            for r in rows:
                p_id = r[1]
                meta = PLATFORM_META.get(p_id, {
                    "name": p_id.capitalize(),
                    "icon": "📱",
                    "color": "#64748B",
                    "badge_class": f"badge-{p_id}",
                    "action_label": "View Post"
                })

                posts.append({
                    "id": r[0],
                    "platform": p_id,
                    "platform_name": meta["name"],
                    "platform_icon": meta["icon"],
                    "platform_color": meta["color"],
                    "platform_badge_class": meta["badge_class"],
                    "action_label": meta["action_label"],
                    "post_id": r[2],
                    "mla_name": r[3],
                    "constituency": r[4],
                    "district": r[5],
                    "author_handle": r[6],
                    "author_name": r[7],
                    "content": r[8],
                    "url": r[9],
                    "media_url": r[10],
                    "likes_count": r[11],
                    "shares_count": r[12],
                    "comments_count": r[13],
                    "views_count": r[14],
                    "sentiment": r[15],
                    "sentiment_label": {"positive": "Positive Post", "negative": "Critical / Negative Post"}.get(r[15], "Neutral Post"),
                    "sentiment_reason": r[16] or None,
                    "published_at": r[17].isoformat() if r[17] else None,
                    "relative_time": _format_relative_time(r[17])
                })

            pos_pct = round((pos_cnt / total_cnt * 100), 1) if total_cnt > 0 else 50.0
            neg_pct = round((neg_cnt / total_cnt * 100), 1) if total_cnt > 0 else 50.0

            # Formatted articles compatible with standard NewsCard / feed
            feed_articles = []
            for p in posts:
                feed_articles.append({
                    "id": f"social_{p['id']}",
                    "title": f"[{p['platform_name']}] {p['content'][:120]}...",
                    "headline": p["content"][:140],
                    "summary": p["content"],
                    "full_description": p["content"],
                    "url": p["url"],
                    "priority_score": 1 if p["sentiment"] == "negative" else 3,
                    "source_type": f"Social Media ({p['platform_name']})",
                    "newspaper_name": f"{p['platform_icon']} {p['platform_name']} • {p['author_name']}",
                    "district_name": p["district"],
                    "constituency_name": p["constituency"],
                    "politician_name": p["mla_name"],
                    "solver_official": "Social Media Intelligence",
                    "department": "Public Grievances & Social Connect",
                    "category": "Social Media News",
                    "date_time": p["published_at"],
                    "sources": [{"publisher": p["platform_name"], "url": p["url"]}],
                    "source_count": 1,
                    "civic_constituencies": [p["constituency"]],
                    "news_type": "social",
                    "is_civic": False,
                    "is_social": True,
                    "is_mla_news": True,
                    "sentiment": p["sentiment"],
                    "sentiment_reason": p["sentiment_reason"],
                    "social_meta": p
                })

            return {
                "status": "success",
                "total_count": total_cnt,
                "positive_count": pos_cnt,
                "negative_count": neg_cnt,
                "neutral_count": neutral_cnt,
                "showing_older": showing_older,
                "platform_counts": plat_counts,
                "mla": {
                    "name": mla_name or (active_mla.get("name") if active_mla else "Telangana State Leadership"),
                    "constituency": constituency or "Statewide",
                    "district": district or "Statewide",
                    "party": active_mla.get("party") if active_mla else "INC / BRS / BJP"
                },
                "stats": {
                    "total_posts": total_cnt,
                    "positive_posts": pos_cnt,
                    "negative_posts": neg_cnt,
                    "neutral_posts": neutral_cnt,
                    "positive_percentage": pos_pct,
                    "negative_percentage": neg_pct,
                    "platform_counts": plat_counts
                },
                "posts": posts,
                "articles": feed_articles
            }

    finally:
        conn.close()


def trigger_social_media_scrape(constituency: str, mla_name: Optional[str] = None, force: bool = False) -> Dict[str, Any]:
    """
    On-demand endpoint to trigger live web scraping for an MLA across social channels.
    """
    if not force:
        with _crawl_lock:
            recent = time.time() - _last_crawl.get(_crawl_key(constituency), 0) < MANUAL_COOLDOWN_SECONDS
            busy = _crawl_key(constituency) in _crawling
        if recent or busy:
            # Searched a moment ago (or right now): do not hit Google again, and say so.
            return {"status": "success", "constituency": constituency, "scraped_count": 0, "saved_count": 0,
                    "skipped": "busy" if busy else "recent"}
    if not mla_name:
        mla_info = get_mla_for_constituency(constituency)
        mla_name = mla_info.get("name") if mla_info else "Constituency Representative"

    district = get_canonical_district(constituency)
    scraped = scrape_social_media_for_mla(mla_name, constituency, district)
    inserted, updated = save_social_posts_to_db(scraped)
    with _crawl_lock:
        _last_crawl[_crawl_key(constituency)] = time.time()

    return {
        "status": "success",
        "mla_name": mla_name,
        "constituency": constituency,
        "scraped_count": len(scraped),
        "saved_count": inserted
    }
