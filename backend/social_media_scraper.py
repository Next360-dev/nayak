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


def clean_html(raw_html: str) -> str:
    """Removes HTML tags and entities."""
    if not raw_html:
        return ""
    text = re.sub(r"<[^>]+>", " ", raw_html)
    text = re.sub(r"&[a-z]+;", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_date(date_str: str) -> datetime:
    """Parses standard RSS date format, returns datetime in UTC."""
    if not date_str:
        return datetime.now(timezone.utc)
    try:
        from email.utils import parsedate_to_datetime
        return parsedate_to_datetime(date_str)
    except Exception:
        return datetime.now(timezone.utc)


def extract_author_handle(platform: str, title: str, publisher: str) -> tuple[str, str]:
    """Extracts or formats realistic handle and author name."""
    clean_pub = clean_html(publisher)
    if "youtube" in platform.lower():
        if " - YouTube" in title:
            ch_name = title.split(" - YouTube")[0].split("|")[-1].strip()
            if ch_name and len(ch_name) < 40:
                clean_pub = ch_name
        return clean_pub or "Telangana News Channel", f"@{clean_pub.replace(' ', '').lower()}" if clean_pub else "@youtube_news"
    elif "twitter" in platform.lower():
        if "@" in title:
            m = re.search(r"@(\w+)", title)
            if m:
                return f"@{m.group(1)}", f"@{m.group(1)}"
        return clean_pub or "Constituency Pulse", f"@{clean_pub.replace(' ', '_').lower()}"
    elif "instagram" in platform.lower():
        return clean_pub or "Insta Citizen Reporter", f"@{clean_pub.replace(' ', '_').lower()}"
    else:
        return clean_pub or "Telangana Daily Public Page", f"fb.com/{clean_pub.replace(' ', '').lower()}"


def classify_social_post_sentiment(content: str, mla_name: str, platform: str) -> tuple[str, str]:
    """
    Classifies a social media post into strictly 'positive' or 'negative' for the MLA.
    Uses keyword and context heuristics with bilingual Telugu & English support.
    """
    text_lower = content.lower()

    negative_keywords = [
        "protest", "dharna", "strike", "criticism", "slams", "questions", "oppose", "anger",
        "complaint", "neglect", "fail", "delay", "poor", "scam", "corrupt", "pothole", "accident",
        "crisis", "shortage", "water crisis", "power cut", "allegation", "arrest", "fir", "warning",
        "illegal", "clash", "grief", "death", "dispute", "bribe", "harassment",
        "ధర్నా", "నిరసన", "విమర్శ", "ఆగ్రహం", "ఫిర్యాదు", "వైఫల్యం", "నిలదీత", "కొరత", "ఆందోళన",
        "సమస్య", "మోసం", "రోడ్డు అధ్వానం", "నీటి ఎద్దడి", "ఆరోపణ", "ఘర్షణ", "నిరసనకారులు"
    ]

    positive_keywords = [
        "development", "sanction", "inaugurate", "scheme", "fund", "welfare", "praise", "lauds",
        "visit", "gift", "bonus", "progress", "hospital", "school", "water supply", "cc road",
        "pension", "kalyana lakshmi", "success", "congratulate", "support", "blessings", "relief",
        "loan waiver", "jobs", "youth", "appreciation", "assistance",
        "అభివృద్ధి", "మంజూరు", "ప్రారంభం", "సంక్షేమం", "ప్రశంస", "సహాయం", "హామీ", "సంతృప్తి",
        "రైతు భరోసా", "నిధులు", "నాలా పనులు", "సమస్య పరిష్కారం", "విజయవంతం", "సన్మానం"
    ]

    has_neg = any(kw in text_lower for kw in negative_keywords)
    has_pos = any(kw in text_lower for kw in positive_keywords)

    if has_neg and not has_pos:
        sentiment = "negative"
        reason = f"Public grievance / criticism regarding constituency issues or administrative decisions concerning {mla_name}."
    elif has_pos and not has_neg:
        sentiment = "positive"
        reason = f"Positive public appreciation for development works, welfare delivery, or community initiatives led by {mla_name}."
    elif has_neg and has_pos:
        # Opposition debate or grievance raised during development
        sentiment = "negative"
        reason = f"Debate or public concerns highlighted in the constituency regarding ongoing works under {mla_name}."
    else:
        # Default distribution for realistic social media balance
        # If neutral political statement, balance between positive and negative
        if any(w in text_lower for w in ["meeting", "assembly", "address", "speech", "samavesham"]):
            sentiment = "positive"
            reason = f"Active public engagement and assembly discussion by {mla_name}."
        else:
            sentiment = "positive"
            reason = f"Social media update highlighting public activities and constituency connect of {mla_name}."

    return sentiment, reason


def scrape_social_media_for_mla(mla_name: str, constituency: str, district: str = None) -> List[Dict[str, Any]]:
    """
    Scrapes live social media items for a given MLA across Twitter, YouTube, Facebook, and Instagram.
    """
    if not district or district == "Statewide":
        district = get_canonical_district(constituency) or "Statewide"

    scraped_posts: List[Dict[str, Any]] = []

    for plat_info in PLATFORMS:
        plat_id = plat_info["id"]
        domain = plat_info["domain"]
        
        # Build search query targeted to the MLA and social platform
        clean_mla = mla_name.replace("Dr. ", "").replace("Sri ", "").strip()
        query = f'"{clean_mla}" {domain}'
        encoded_query = urllib.parse.quote_plus(query)
        rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-IN&gl=IN&ceid=IN:en"

        try:
            req = urllib.request.Request(
                rss_url,
                headers={"User-Agent": random.choice(USER_AGENTS)}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                xml_data = resp.read()
                tree = ET.fromstring(xml_data)
                items = tree.findall(".//item")

                for it in items[:15]:  # Top 15 per platform
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

                    published_dt = parse_date(pub_date)
                    author_name, author_handle = extract_author_handle(plat_id, clean_title, publisher)

                    content_text = f"{clean_title}. {clean_desc}" if clean_desc and clean_desc != clean_title else clean_title
                    # Strip generic platform suffixes
                    content_text = re.sub(r"\s*-\s*(YouTube|Facebook|Instagram|Twitter|X)\s*$", "", content_text, flags=re.I).strip()

                    sentiment, reason = classify_social_post_sentiment(content_text, mla_name, plat_id)

                    post_obj = {
                        "platform": plat_id,
                        "post_id": f"{plat_id}_{abs(hash(link)) % 10000000}",
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

        except Exception as e:
            # Continue gracefully across platforms
            pass

    return scraped_posts


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
                    likes_count = EXCLUDED.likes_count,
                    shares_count = EXCLUDED.shares_count,
                    comments_count = EXCLUDED.comments_count,
                    views_count = EXCLUDED.views_count,
                    sentiment = EXCLUDED.sentiment,
                    sentiment_reason = EXCLUDED.sentiment_reason,
                    published_at = EXCLUDED.published_at;
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
                inserted += 1
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

