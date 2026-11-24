"""
date_extractor.py - High-Precision Publication Date Extraction & Verification
Extracts true article publication dates from:
1. Card HTML (<time>, class attributes, relative timestamps like '10 mins ago')
2. URL patterns (e.g., /2026/08/20/ or /20260917/)
3. Article HTML metadata (<meta property="article:published_time">, JSON-LD, etc.) via streamed HTTP request

Enforces strict freshness checks so old/archived articles are NEVER stamped as today's news.
"""

import re
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from bs4 import BeautifulSoup, Tag
from dateutil import parser as date_parser
import httpx

# IST = UTC+5:30 (Asia/Kolkata)
IST = timezone(timedelta(hours=5, minutes=30))

def now_ist() -> datetime:
    """Returns current datetime in IST (Asia/Kolkata)."""
    return datetime.now(IST)

logger = logging.getLogger("date_extractor")

# Match common relative time strings (English & Telugu)
RE_MINUTES_AGO = re.compile(r"(\d+)\s*(?:min|mins|minute|minutes)\s*(?:ago)?", re.I)
RE_HOURS_AGO = re.compile(r"(\d+)\s*(?:hr|hrs|hour|hours)\s*(?:ago)?", re.I)
RE_DAYS_AGO = re.compile(r"(\d+)\s*(?:day|days)\s*(?:ago)?", re.I)

# Telugu relative time expressions
RE_TE_MINUTES = re.compile(r"(\d+)\s*(?:నిమిషాల|నిమిషం|నిమిషాల్లో)\s*(?:క్రితం)?")
RE_TE_HOURS = re.compile(r"(\d+)\s*(?:గంటల|గంట)\s*(?:క్రితం)?")
RE_TE_DAYS = re.compile(r"(\d+)\s*(?:రోజుల|రోజు)\s*(?:క్రితం)?")

# Match date patterns in URLs like /2026/08/20/ or /2026-08-20/ or /20260820/
RE_URL_DATE = re.compile(r"/(202[4-9])[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])", re.I)
RE_URL_DATE_COMPACT = re.compile(r"/(202[4-9])(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/", re.I)

META_DATE_PROPERTIES = [
    "article:published_time",
    "og:published_time",
    "published_time",
    "publishdate",
    "pubdate",
    "date",
    "itemprop:datepublished",
    "article:modified_time",
    "og:updated_time"
]

def parse_relative_time(text: str, now: datetime) -> Optional[datetime]:
    """Parses relative time strings in English and Telugu like:
    '5 minutes ago', '2 hours ago', 'just now',
    '10 నిమిషాల క్రితం', '2 గంటల క్రితం', 'ఇప్పుడే', 'తాజాగా', 'నిన్న'.
    'now' should be in IST so relative offsets resolve correctly.
    """
    if not text:
        return None
    cleaned = text.strip().lower()
    if any(tok in cleaned for tok in ("just now", "now", "ఇప్పుడే", "తాజాగా")):
        return now
    if "నిన్న" in cleaned or "yesterday" in cleaned:
        return now - timedelta(days=1)
        
    m_min = RE_MINUTES_AGO.search(cleaned) or RE_TE_MINUTES.search(cleaned)
    if m_min:
        return now - timedelta(minutes=int(m_min.group(1)))
        
    m_hr = RE_HOURS_AGO.search(cleaned) or RE_TE_HOURS.search(cleaned)
    if m_hr:
        return now - timedelta(hours=int(m_hr.group(1)))
        
    m_day = RE_DAYS_AGO.search(cleaned) or RE_TE_DAYS.search(cleaned)
    if m_day:
        return now - timedelta(days=int(m_day.group(1)))
        
    return None

def extract_date_from_url(url: str) -> Optional[datetime]:
    """Extracts publication date from URL slug if present (e.g. /2026/08/20/).
    Returns date at midnight IST so comparisons are India-local.
    """
    if not url:
        return None
    m = RE_URL_DATE.search(url)
    if m:
        try:
            year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
            return datetime(year, month, day, 0, 0, 0, tzinfo=IST)
        except Exception:
            pass
            
    m2 = RE_URL_DATE_COMPACT.search(url)
    if m2:
        try:
            year, month, day = int(m2.group(1)), int(m2.group(2)), int(m2.group(3))
            return datetime(year, month, day, 0, 0, 0, tzinfo=IST)
        except Exception:
            pass
            
    return None

def extract_card_datetime(anchor_or_card: Tag, now: datetime) -> Optional[datetime]:
    """
    Attempts to extract publication datetime directly from card container HTML.
    Looks for <time> tags, date/time class attributes, or relative timestamps.
    """
    if not anchor_or_card:
        return None
        
    parent = anchor_or_card if anchor_or_card.name != "a" else anchor_or_card.find_parent(["article", "li", "div", "section"])
    if not parent:
        return None

    # 1. <time> tag
    time_tag = parent.find("time")
    if time_tag:
        dt_str = time_tag.get("datetime") or time_tag.get_text().strip()
        if dt_str:
            rel = parse_relative_time(dt_str, now)
            if rel:
                return rel
            try:
                parsed = date_parser.parse(dt_str)
                # Assume IST if no tz info (Indian news sites almost always publish in IST)
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=IST)
            except Exception:
                pass

    # 2. Elements with date/time classes
    for el in parent.find_all(["span", "div", "p", "small"], class_=re.compile(r"(date|time|posted|timestamp|publish)", re.I)):
        text = el.get_text().strip()
        if not text or len(text) > 60:
            continue
        rel = parse_relative_time(text, now)
        if rel:
            return rel
        try:
            # Check if text contains recognisable date
            parsed = date_parser.parse(text, fuzzy=True)
            if parsed and parsed.year >= 2020:
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=IST)
        except Exception:
            pass

    return None

def extract_article_metadata_datetime(html_text: str) -> Optional[datetime]:
    """
    Extracts published datetime from full/partial HTML (first 35KB) using
    meta tags, JSON-LD datePublished, or <time> tags.
    """
    if not html_text:
        return None
        
    soup = BeautifulSoup(html_text[:40000], "html.parser")
    
    # 1. Meta tags
    for prop in META_DATE_PROPERTIES:
        tag = (
            soup.find("meta", property=prop) or 
            soup.find("meta", attrs={"name": prop}) or 
            soup.find("meta", attrs={"itemprop": prop})
        )
        if tag and tag.get("content"):
            content = tag["content"].strip()
            try:
                dt = date_parser.parse(content)
                # Assume IST when no timezone is present
                return dt if dt.tzinfo else dt.replace(tzinfo=IST)
            except Exception:
                pass

    # 2. JSON-LD datePublished / dateModified
    for s in soup.find_all("script", type="application/ld+json"):
        if not s.string:
            continue
        try:
            data = json.loads(s.string)
            found_dt = None
            def search_ld(obj):
                nonlocal found_dt
                if isinstance(obj, dict):
                    for k in ["datePublished", "dateModified", "uploadDate"]:
                        if k in obj and obj[k]:
                            try:
                                parsed = date_parser.parse(obj[k])
                                # Assume IST when no timezone is present
                                found_dt = parsed if parsed.tzinfo else parsed.replace(tzinfo=IST)
                                return
                            except Exception:
                                pass
                    if "@graph" in obj and isinstance(obj["@graph"], list):
                        for item in obj["@graph"]:
                            search_ld(item)
                            if found_dt:
                                return
                elif isinstance(obj, list):
                    for item in obj:
                        search_ld(item)
                        if found_dt:
                            return
            search_ld(data)
            if found_dt:
                return found_dt
        except Exception:
            pass

    # 3. First <time> tag in head/body
    time_tag = soup.find("time")
    if time_tag:
        dt_val = time_tag.get("datetime") or time_tag.get_text().strip()
        if dt_val:
            try:
                dt = date_parser.parse(dt_val)
                return dt if dt.tzinfo else dt.replace(tzinfo=IST)
            except Exception:
                pass

    return None

def fetch_article_datetime_streamed(client: httpx.Client, url: str) -> Optional[datetime]:
    """
    Downloads only the first ~35KB of the article to extract metadata datetime rapidly.
    Returns datetime or None.
    """
    try:
        with client.stream("GET", url, follow_redirects=True, timeout=7.0) as resp:
            if resp.status_code != 200:
                return None
            chunks = []
            total_bytes = 0
            for chunk in resp.iter_bytes(chunk_size=4096):
                chunks.append(chunk)
                total_bytes += len(chunk)
                if total_bytes > 35000 or b"</head>" in chunk:
                    break
            html_text = b"".join(chunks).decode("utf-8", errors="ignore")
            return extract_article_metadata_datetime(html_text)
    except Exception as e:
        logger.debug(f"Failed to stream head for {url}: {e}")
        return None

def get_verified_article_datetime(
    anchor_tag: Optional[Tag],
    url: str,
    client: Optional[httpx.Client] = None,
    now: Optional[datetime] = None,
    max_age_hours: float = 36.0
) -> Tuple[Optional[datetime], bool]:
    """
    Resolves the true publication date of an article:
    1. Checks card container HTML first (0ms overhead)
    2. Checks URL date slug (0ms overhead)
    3. If unresolved or ambiguous, streams article head metadata
    
    Uses IST (Asia/Kolkata) as reference time so articles published
    late evening in India are stamped as the correct Indian calendar date.
    Returns: (datetime or None, is_fresh: bool)
    """
    # Always use IST as reference — fixes date mismatch for late-night IST articles
    now_ist_val = now or now_ist()
    
    # 1. Card container check
    if anchor_tag:
        card_dt = extract_card_datetime(anchor_tag, now_ist_val)
        if card_dt:
            # Normalize card_dt to IST for age comparison
            card_dt_ist = card_dt.astimezone(IST) if card_dt.tzinfo else card_dt.replace(tzinfo=IST)
            age = (now_ist_val - card_dt_ist).total_seconds() / 3600.0
            return card_dt_ist, (0 <= age <= max_age_hours)
            
    # 2. URL slug check
    url_dt = extract_date_from_url(url)
    if url_dt:
        url_dt_ist = url_dt.astimezone(IST)
        age = (now_ist_val - url_dt_ist).total_seconds() / 3600.0
        # If URL indicates it is clearly from a previous month/year, reject immediately
        if age > max_age_hours:
            return url_dt_ist, False

    # 3. Stream article head metadata
    if client:
        art_dt = fetch_article_datetime_streamed(client, url)
        if art_dt:
            art_dt_ist = art_dt.astimezone(IST) if art_dt.tzinfo else art_dt.replace(tzinfo=IST)
            age = (now_ist_val - art_dt_ist).total_seconds() / 3600.0
            return art_dt_ist, (0 <= age <= max_age_hours)

    return None, False
