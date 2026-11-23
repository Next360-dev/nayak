"""
social_media_scraper.py - High-Performance Social Media Scraper Engine for MLAs
Finds public mentions of an MLA on these platforms via web search (Google News RSS
restricted to each platform's domain). Engagement counts (likes, views, ...) are NOT
available from this source, so they are stored as NULL, never estimated.
Platforms searched:
  - Instagram (📷)
  - Twitter / X (🐦)
  - YouTube (▶️)
  - Facebook (📘)

Classifies every post into POSITIVE or NEGATIVE sentiment for the individual MLA,
and stores the results in the PostgreSQL `social_media_posts` table.
"""

import os
import sys
import re
import random
import hashlib
import logging
from concurrent.futures import ThreadPoolExecutor
import time
import urllib.error
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

# Ensure backend root is on path
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from app.core.database import get_connection
from data.constituency_mappings import (
    get_canonical_district, get_mla_for_constituency
)

log = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
]

PLATFORMS = [
    {
        "id": "twitter",
        "name": "Twitter / X",
        "domain": "site:x.com",
        "default_author": "@TelanganaVoice",
        "badge_color": "#1DA1F2"
    },
    {
        "id": "youtube",
        "name": "YouTube",
        "domain": "site:youtube.com",
        "default_author": "Telangana Assembly & News",
        "badge_color": "#FF0000"
    },
    {
        "id": "facebook",
        "name": "Facebook",
        "domain": "site:facebook.com",
        "default_author": "Telangana Public Watch",
        "badge_color": "#1877F2"
    },
    {
        "id": "instagram",
        "name": "Instagram",
        "domain": "site:instagram.com",
        "default_author": "telangana_updates",
        "badge_color": "#E1306C"
    }
]


_TITLES = re.compile(r"^(dr|sri|shri|smt|mr|mrs|ms|prof|er|adv)\.?\s+", re.I)


def name_variants(mla_name: str) -> tuple[str, str]:
    """(full name, short name). Titles are dropped; the short name is the last two words, which is how
    local media usually write a long name ("Chikudu Vamshi Krishna" -> "Vamshi Krishna")."""
    full = " ".join(_TITLES.sub("", (mla_name or "").strip()).replace(".", " ").split())
    words = full.split()
    short = " ".join(words[-2:]) if len(words) > 2 else full
    return full, short


def constituency_base(constituency: str) -> str:
    """"Achampet (SC)" -> "Achampet"."""
    return re.sub(r"\s*\(.*?\)\s*", " ", constituency or "").strip()


def search_queries(mla_name: str, constituency: str, domain: str) -> list[str]:
    """Several ways to ask, from exact to loose. One exact quoted name finds nothing for most MLAs."""
    full, short = name_variants(mla_name)
    cons = constituency_base(constituency)
    queries = [f'"{full}" {domain}']
    if short and short.lower() != full.lower():
        queries.append(f'"{short}" {cons} {domain}'.replace("  ", " "))
    return list(dict.fromkeys(q for q in queries if q.strip()))


def mentions_leader(text: str, mla_name: str) -> bool:
    """A broader search can return unrelated pages, so keep only items that actually name the person."""
    full, short = name_variants(mla_name)
    low = (text or "").lower()
    return bool(full and full.lower() in low) or bool(short and short.lower() in low)



_PLATFORM_TAIL = re.compile(r"[\s\-–|]*(instagram|youtube|facebook|twitter|x)\s*$", re.I)


def _same_text(text: str) -> str:
    """Letters and digits only, lower case, platform name at the end removed: for comparing, never for display."""
    return re.sub(r"[\W_]+", "", _PLATFORM_TAIL.sub("", text or ""), flags=re.UNICODE).lower()


def join_title_and_description(title: str, desc: str) -> str:
    """Google's description usually just repeats the title (plus the publisher), so only add it when it says more."""
    if not desc:
        return title
    t, d = _same_text(title), _same_text(desc)
    if not d or d in t or t in d or d[:40] == t[:40]:
        return title
    return f"{title}. {desc}"


def make_post_id(platform: str, link: str) -> str:
    """Same link, same id, on every run and every restart (Python's built-in hash() is different each process)."""
    return f"{platform}_{hashlib.sha1((link or '').encode()).hexdigest()[:12]}"


def clean_html(raw_html: str) -> str:
    """Removes HTML tags and entities."""
    if not raw_html:
        return ""
    text = re.sub(r"<[^>]+>", " ", raw_html)
    text = re.sub(r"&[a-z]+;", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_date(date_str: str) -> Optional[datetime]:
    """Parses the RSS date. Returns None when it is missing or unreadable (never "now": that would fake freshness)."""
    if not date_str:
        return None
    try:
        from email.utils import parsedate_to_datetime
        return parsedate_to_datetime(date_str)
    except Exception:
        return None


def extract_author_handle(platform: str, title: str, publisher: str) -> tuple[Optional[str], Optional[str]]:
    """(author name, handle). Only what the search result really says: the publisher / channel name, and an
    @handle only when the text contains one. Nothing is invented; unknown stays None."""
    name = clean_html(publisher) or None
    plat = platform.lower()
    if "youtube" in plat and " - YouTube" in (title or ""):
        channel = title.split(" - YouTube")[0].split("|")[-1].strip()
        if channel and len(channel) < 40:
            name = channel
    handle = None
    if "twitter" in plat:
        m = re.search(r"@(\w+)", title or "")
        if m:
            handle = f"@{m.group(1)}"
            name = name or handle
    return name, handle


NEGATIVE_WORDS = [
    "protest", "dharna", "strike", "criticism", "slams", "oppose", "anger",
    "complaint", "neglect", "fail", "delay", "poor", "scam", "corrupt", "pothole", "accident",
    "crisis", "shortage", "power cut", "allegation", "arrest", "fir", "warning",
    "illegal", "clash", "grief", "death", "dispute", "bribe", "harassment",
    "ధర్నా", "నిరసన", "విమర్శ", "ఆగ్రహం", "ఫిర్యాదు", "వైఫల్యం", "నిలదీత", "కొరత", "ఆందోళన",
    "సమస్య", "మోసం", "రోడ్డు అధ్వానం", "నీటి ఎద్దడి", "ఆరోపణ", "ఘర్షణ", "నిరసనకారులు",
]
POSITIVE_WORDS = [
    "development", "sanction", "inaugurat", "scheme", "funds", "welfare", "praise", "lauds",
    "gift", "bonus", "progress", "hospital", "school", "water supply", "cc road",
    "pension", "kalyana lakshmi", "success", "congratulat", "blessings", "relief",
    "loan waiver", "appreciation", "assistance",
    "అభివృద్ధి", "మంజూరు", "ప్రారంభం", "సంక్షేమం", "ప్రశంస", "సహాయం", "హామీ", "సంతృప్తి",
    "రైతు భరోసా", "నిధులు", "నాలా పనులు", "సమస్య పరిష్కారం", "విజయవంతం", "సన్మానం",
]
# Short words that must match as a whole word ("fir" must not fire on "first" or "confirm").
_WHOLE_WORD_ONLY = {"fir"}


def _matched_words(text_lower: str, words: List[str]) -> List[str]:
    """Which listed words occur. English words must start a word ("fund" is not inside "refund");
    Telugu words are matched as written."""
    hits = []
    for w in words:
        if w.isascii():
            tail = r"(?![a-z])" if w in _WHOLE_WORD_ONLY else ""
            if re.search(rf"(?<![a-z]){re.escape(w)}{tail}", text_lower):
                hits.append(w)
        elif w in text_lower:
            hits.append(w)
    return hits


def classify_social_post_sentiment(content: str, mla_name: str, platform: str) -> tuple[str, str]:
    """
    Tone of one post: 'positive', 'negative' or 'neutral'. A keyword check on English and Telugu words,
    nothing smarter. A post with no tone words is NEUTRAL (it used to be called positive, which was a guess),
    and the reason names the words that decided it, so a reader can see why.
    """
    text_lower = (content or "").lower()
    neg = _matched_words(text_lower, NEGATIVE_WORDS)
    pos = _matched_words(text_lower, POSITIVE_WORDS)
    shown = lambda ws: ", ".join(f"\"{w}\"" for w in ws[:3])  # noqa: E731

    if neg and pos:
        # Both kinds of words: keep it visible as a concern, and say it is mixed.
        return "negative", f"Mixed: critical words ({shown(neg)}) and positive words ({shown(pos)}). Flagged for a look."
    if neg:
        return "negative", f"Critical words found: {shown(neg)}."
    if pos:
        return "positive", f"Positive words found: {shown(pos)}."
    return "neutral", "No positive or critical words found, so the tone is not clear."


REQUEST_PAUSE_SECONDS = 0.6
RETRY_WAIT_SECONDS = 3.0


def _fetch_feed(url: str, plat_id: str, query: str):
    """Fetch one RSS feed. Retries once on HTTP 429. Returns the parsed XML, or None after logging why it failed."""
    for attempt in (1, 2):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": random.choice(USER_AGENTS)})
            with urllib.request.urlopen(req, timeout=10) as resp:
                return ET.fromstring(resp.read())
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt == 1:
                time.sleep(RETRY_WAIT_SECONDS)
                continue
            log.warning("social scrape: %s query %r failed: HTTP %s", plat_id, query, e.code)
        except Exception as e:  # network error or bad XML: skip this query, keep the rest
            log.warning("social scrape: %s query %r failed: %s", plat_id, query, e)
        return None
    return None


def _scrape_platform(plat_info: Dict[str, Any], mla_name: str, constituency: str, district: str) -> List[Dict[str, Any]]:
    """All posts for one platform (a few search variants, filtered to items that name the person)."""
    scraped_posts: List[Dict[str, Any]] = []
    plat_id = plat_info["id"]
    domain = plat_info["domain"]
    
    items = []
    seen_links: set[str] = set()
    for query in search_queries(mla_name, constituency, domain):
        encoded_query = urllib.parse.quote_plus(query)
        rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-IN&gl=IN&ceid=IN:en"
        tree = _fetch_feed(rss_url, plat_id, query)
        if tree is None:
            continue
        time.sleep(REQUEST_PAUSE_SECONDS)  # be polite: Google rate-limits bursts (HTTP 429)
        for it in tree.findall(".//item"):
            link_el = it.find("link")
            link = link_el.text if link_el is not None else ""
            if link and link not in seen_links:
                seen_links.add(link)
                items.append(it)

    for it in items[:20]:  # Top 20 per platform
        raw_title = it.find("title").text if it.find("title") is not None else ""
        raw_desc = it.find("description").text if it.find("description") is not None else ""
        link = it.find("link").text if it.find("link") is not None else ""
        pub_date = it.find("pubDate").text if it.find("pubDate") is not None else ""
        source_tag = it.find("source")
        publisher = source_tag.text if source_tag is not None else plat_info["name"]

        clean_title = clean_html(raw_title)
        clean_desc = clean_html(raw_desc)
        if not clean_title or len(clean_title) < 12:
            continue
        if not mentions_leader(f"{clean_title} {clean_desc}", mla_name):
            continue

        published_dt = parse_date(pub_date)
        if published_dt is None:
            continue  # cannot place it in time, so it cannot be shown honestly
        author_name, author_handle = extract_author_handle(plat_id, clean_title, publisher)

        content_text = join_title_and_description(clean_title, clean_desc)
        # Strip generic platform suffixes
        content_text = re.sub(r"\s*-\s*(YouTube|Facebook|Instagram|Twitter|X)\s*$", "", content_text, flags=re.I).strip()

        sentiment, reason = classify_social_post_sentiment(content_text, mla_name, plat_id)

        post_obj = {
            "platform": plat_id,
            "post_id": make_post_id(plat_id, link),
            "mla_name": mla_name,
            "constituency": constituency,
            "district": district,
            "author_handle": author_handle,
            "author_name": author_name,
            "content": content_text,
            "url": link,
            "media_url": None,
            "likes_count": None,  # not available from a web-search mention
            "shares_count": None,  # not available from a web-search mention
            "comments_count": None,  # not available from a web-search mention
            "views_count": None,  # not available from a web-search mention
            "sentiment": sentiment,
            "sentiment_reason": reason,
            "published_at": published_dt.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        scraped_posts.append(post_obj)

    return scraped_posts


def scrape_social_media_for_mla(mla_name: str, constituency: str, district: str = None) -> List[Dict[str, Any]]:
    """
    Scrapes live social media items for a given MLA across Twitter, YouTube, Facebook, and Instagram.
    The four platforms are searched in parallel (each one still pauses between its own requests).
    """
    if not district or district == "Statewide":
        district = get_canonical_district(constituency) or "Statewide"

    with ThreadPoolExecutor(max_workers=len(PLATFORMS)) as pool:
        results = list(pool.map(lambda plat: _scrape_platform(plat, mla_name, constituency, district), PLATFORMS))
    return [post for platform_posts in results for post in platform_posts]


def save_social_posts_to_db(posts: List[Dict[str, Any]]) -> tuple[int, int]:
    """
    Saves or updates social media posts in the `social_media_posts` PostgreSQL table.
    Returns (inserted_count, updated_count).
    """
    if not posts:
        return 0, 0

    inserted = 0
    updated = 0

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            for p in posts:
                upsert_sql = """
                INSERT INTO social_media_posts (
                    platform, post_id, mla_name, constituency, district,
                    author_handle, author_name, content, url, media_url,
                    likes_count, shares_count, comments_count, views_count,
                    sentiment, sentiment_reason, published_at, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s
                )
                ON CONFLICT (platform, url) DO UPDATE SET
                    content = EXCLUDED.content,
                    likes_count = EXCLUDED.likes_count,
                    shares_count = EXCLUDED.shares_count,
                    comments_count = EXCLUDED.comments_count,
                    views_count = EXCLUDED.views_count,
                    sentiment = EXCLUDED.sentiment,
                    sentiment_reason = EXCLUDED.sentiment_reason,
                    published_at = EXCLUDED.published_at
                RETURNING (xmax = 0) AS was_inserted;
                """
                cur.execute(upsert_sql, (
                    p["platform"],
                    p["post_id"],
                    p["mla_name"],
                    p["constituency"],
                    p["district"],
                    p["author_handle"],
                    p["author_name"],
                    p["content"],
                    p["url"],
                    p.get("media_url"),
                    p["likes_count"],
                    p["shares_count"],
                    p["comments_count"],
                    p["views_count"],
                    p["sentiment"],
                    p["sentiment_reason"],
                    p["published_at"],
                    p.get("created_at")
                ))
                if cur.fetchone()[0]:
                    inserted += 1
                else:
                    updated += 1
        conn.commit()
    finally:
        conn.close()

    return inserted, updated


if __name__ == "__main__":
    print("Testing social media scraper for Revanth Reddy (Kodangal)...")
    posts = scrape_social_media_for_mla("Anumula Revanth Reddy", "Kodangal", "Vikarabad")
    print(f"Scraped {len(posts)} live posts.")
    ins, _ = save_social_posts_to_db(posts)
    print(f"Persisted {ins} posts to DB.")

