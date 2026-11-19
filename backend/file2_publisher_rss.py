"""
file2_publisher_rss.py - Direct Publisher RSS & Sitemap Ingestion Engine
Ingests official feeds from 18+ verified regional portals & TV channels:
(Andhra Jyothi, HMTV Live, Namasthe Telangana, Telangana Today, The Hindu,
V6 Velugu, TV9, NTV, Disha Daily, 10TV, Vaartha, Times of India, Mana Telangana, etc.)
Assigns districts via accurate bilingual keyword matching.
Output: List[Dict]
"""

import sys
import re
import html
import logging
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any

import httpx
from news_window import NEWS_WINDOW_HOURS
import feedparser
from image_utils import image_from_entry
from district_data import DISTRICT_KEYWORDS, detect_district_from_text
from deduplication import get_canonical_publisher, is_non_governance_content
from constituency_mappings import classify_article_constituency, get_canonical_district

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("file2_publisher_rss")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

# Verified Direct RSS Feed & Google News Sitemap URLs across Telangana
PUBLISHER_FEEDS = [
    # --- Major Regional Telugu Daily Newspapers & TV Channels ---
    {
        "publisher": "Andhra Jyothi",
        "url": "https://www.andhrajyothy.com/sitemaps/news-sitemap.xml",
        "default_district": "Statewide",
        "type": "sitemap"
    },
    {
        "publisher": "Namasthe Telangana",
        "url": "https://ntnews.com/feed",
        "default_district": "Statewide",
        "type": "rss"
    },
    {
        "publisher": "HMTV Live",
        "url": "https://www.hmtvlive.com/feed",
        "default_district": "Statewide",
        "type": "rss"
    },
    {
        "publisher": "Telangana Today",
        "url": "https://telanganatoday.com/feed",
        "default_district": "Statewide",
        "type": "rss"
    },
    {
        "publisher": "V6 Velugu",
        "url": "https://www.v6velugu.com/feed/",
        "default_district": "Statewide",
        "type": "rss"
    },
    {
        "publisher": "TV9 Telugu",
        "url": "https://tv9telugu.com/feed",
        "default_district": "Statewide",
        "type": "rss"
    },
    {
        "publisher": "NTV Telugu",
        "url": "https://ntvtelugu.com/feed",
        "default_district": "Statewide",
        "type": "rss"
    },
    {
        "publisher": "10TV Telugu",
        "url": "https://10tv.in/feed",
        "default_district": "Statewide",
        "type": "rss"
    },
    {
        "publisher": "Vaartha",
        "url": "https://www.vaartha.com/feed/",
        "default_district": "Statewide",
        "type": "rss"
    },
    {
        "publisher": "Mana Telangana",
        "url": "https://www.manatelangana.news/feed",
        "default_district": "Statewide",
        "type": "rss"
    },
    {
        "publisher": "Nava Telangana",
        "url": "https://navatelangana.com/feed",
        "default_district": "Statewide",
        "type": "rss"
    },
    # --- National & English Telangana Desks ---
    {
        "publisher": "The Hindu",
        "url": "https://www.thehindu.com/news/national/telangana/feeder/default.rss",
        "default_district": "Statewide",
        "type": "rss"
    },
    {
        "publisher": "The Hindu",
        "url": "https://www.thehindu.com/news/cities/Hyderabad/feeder/default.rss",
        "default_district": "Statewide",
        "type": "rss"
    },
    {
        "publisher": "Times of India",
        "url": "https://timesofindia.indiatimes.com/rssfeeds/-2128838597.cms",
        "default_district": "Statewide",
        "type": "rss"
    },
    {
        "publisher": "Times of India",
        "url": "https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms",
        "default_district": "Statewide",
        "type": "rss"
    },
    {
        "publisher": "The Hans India",
        "url": "https://www.thehansindia.com/rss/telangana",
        "default_district": "Statewide",
        "type": "rss"
    },
    {
        "publisher": "Samayam Telugu",
        "url": "https://telugu.samayam.com/telangana/news/rssfeed/70465923.xml",
        "default_district": "Statewide",
        "type": "rss"
    },
    {
        "publisher": "OneIndia Telugu",
        "url": "https://telugu.oneindia.com/rss/feeds/telugu-news-fb.xml",
        "default_district": "Statewide",
        "type": "rss"
    }
]

def clean_html(raw_html: str) -> str:
    """Removes HTML tags and cleans up entities."""
    if not raw_html:
        return ""
    clean = re.sub(r"<[^>]+>", " ", raw_html)
    clean = html.unescape(clean)
    return re.sub(r"\s+", " ", clean).strip()

def fetch_feed(client: httpx.Client, feed_meta: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Fetches and parses a single publisher RSS or Sitemap feed, keeping strictly today's daily stories."""
    import xml.etree.ElementTree as ET

    records = []
    publisher = feed_meta["publisher"]
    url = feed_meta["url"]
    feed_type = feed_meta.get("type", "rss")
    default_dist = feed_meta.get("default_district", "Statewide")
    now_utc = datetime.now(timezone.utc)
    MAX_AGE_HOURS = NEWS_WINDOW_HOURS   # see news_window.py
    
    try:
        resp = client.get(url, timeout=12.0)
        if resp.status_code != 200:
            logger.warning(f"Failed feed {publisher} ({url}): HTTP {resp.status_code}")
            return records

        if feed_type == "sitemap":
            # Handle Google News Sitemap XML (e.g. Andhra Jyothi)
            try:
                root = ET.fromstring(resp.text)
                ns = {
                    's': 'http://www.sitemaps.org/schemas/sitemap/0.9',
                    'news': 'http://www.google.com/schemas/sitemap-news/0.9'
                }
                for url_tag in root.findall('s:url', ns):
                    loc_elem = url_tag.find('s:loc', ns)
                    news_elem = url_tag.find('news:news', ns)
                    link = loc_elem.text.strip() if loc_elem is not None and loc_elem.text else ""
                    if not link or news_elem is None:
                        continue

                    title_elem = news_elem.find('news:title', ns)
                    pub_elem = news_elem.find('news:publication_date', ns)
                    title = title_elem.text.strip() if title_elem is not None and title_elem.text else ""
                    if not title or len(title) < 15:
                        continue

                    if is_non_governance_content(title, "", link):
                        continue

                    # Filter age: must be fresh within MAX_AGE_HOURS
                    pub_dt = None
                    if pub_elem is not None and pub_elem.text:
                        try:
                            pub_str = pub_elem.text.strip().replace('Z', '+00:00')
                            parsed = datetime.fromisoformat(pub_str)
                            if parsed.tzinfo is None:
                                parsed = parsed.replace(tzinfo=timezone.utc)
                            age_hours = (now_utc - parsed).total_seconds() / 3600
                            if 0 <= age_hours <= MAX_AGE_HOURS:
                                pub_dt = parsed
                        except Exception:
                            pass

                    if not pub_dt:
                        continue  # Skip unverified or older sitemap items

                    clean_t = clean_html(title)
                    district = detect_district_from_text(f"{clean_t} {link}", default=default_dist)
                    
                    # Refine district using local assembly constituency mappings if available
                    c_name, c_dist, all_c, leaders, civic_c = classify_article_constituency(clean_t, clean_t, return_all=True)
                    if (not district or district == "Statewide") and c_name and c_name != "Statewide":
                        district = c_dist or district

                    c_pub = get_canonical_publisher(publisher, link)

                    records.append({
                        "title": clean_t,
                        "district": district,
                        "constituency": c_name or "Statewide",
                        "civic_constituencies": civic_c or [],
                        "state": "Telangana",
                        "summary": clean_t[:400],
                        "publisher": c_pub,
                        "url": link,
                        "published_at": pub_dt.isoformat()
                    })
            except Exception as se:
                logger.warning(f"Sitemap parse error for {publisher}: {se}")
            return records

        # Standard RSS parsing (capped to top 200 fresh items per feed)
        feed = feedparser.parse(resp.text)
        
        for entry in feed.entries[:200]:
            raw_title = getattr(entry, "title", "")
            title = clean_html(raw_title)
            if not title or len(title) < 15:
                continue
                
            raw_summary = getattr(entry, "summary", "") or getattr(entry, "description", "")
            summary = clean_html(raw_summary) or title
            link = getattr(entry, "link", "")
            if not link:
                continue

            if is_non_governance_content(title, summary, link):
                continue

            # Strict age check: Skip past / historical news older than 36 hours
            published_dt = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                try:
                    parsed_dt = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
                    age_hours = (now_utc - parsed_dt).total_seconds() / 3600
                    if 0 <= age_hours <= MAX_AGE_HOURS:
                        published_dt = parsed_dt
                except Exception:
                    pass
            elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
                try:
                    parsed_dt = datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)
                    age_hours = (now_utc - parsed_dt).total_seconds() / 3600
                    if 0 <= age_hours <= MAX_AGE_HOURS:
                        published_dt = parsed_dt
                except Exception:
                    pass

            if not published_dt:
                continue  # Discard unverified or stale news
                
            # Assign district via bilingual keyword matching
            combined_text = f"{title} {summary} {link}"
            district = detect_district_from_text(combined_text, default=default_dist)
            
            # Refine district using local assembly constituency mappings if available
            c_name, c_dist, all_c, leaders, civic_c = classify_article_constituency(title, summary, return_all=True)
            if (not district or district == "Statewide") and c_name and c_name != "Statewide":
                district = c_dist or district

            c_pub = get_canonical_publisher(publisher, link)
                    
            record = {
                "title": title,
                "district": district,
                "constituency": c_name or "Statewide",
                "civic_constituencies": civic_c or [],
                "state": "Telangana",
                "summary": summary[:400],
                "publisher": c_pub,
                "url": link,
                "published_at": published_dt.isoformat()
            }
            img = image_from_entry(entry, raw_summary, link)
            if img:
                record["image_url"] = img
            records.append(record)
            
    except Exception as e:
        logger.warning(f"Error reading feed {publisher} ({url}): {e}")
        
    return records

def collect_publisher_rss(max_workers: int = 8) -> List[Dict[str, Any]]:
    """
    Main entrypoint for Layer 1 Publisher RSS collector.
    Fetches direct feeds concurrently and assigns districts via bilingual keywords.
    Returns: List[Dict]
    """
    logger.info("Starting high-accuracy Publisher RSS collection...")
    all_records = []
    
    with httpx.Client(headers=HEADERS, follow_redirects=True) as client:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_feed = {executor.submit(fetch_feed, client, f): f for f in PUBLISHER_FEEDS}
            for future in as_completed(future_to_feed):
                feed_info = future_to_feed[future]
                try:
                    recs = future.result()
                    all_records.extend(recs)
                    logger.info(f"Fetched {len(recs)} articles from {feed_info['publisher']}")
                except Exception as exc:
                    logger.error(f"Error fetching {feed_info['publisher']}: {exc}")
                    
    logger.info(f"Publisher RSS collection complete. Total raw records: {len(all_records)}")
    return all_records

if __name__ == "__main__":
    records = collect_publisher_rss()
    print(f"Collected {len(records)} records from Publisher RSS.")
    if records:
        print("\nSample Record:")
        for k, v in records[0].items():
            val_str = str(v)
            try:
                print(f"  {k}: {val_str[:120]}")
            except Exception:
                print(f"  {k}: {val_str.encode('ascii', errors='replace').decode('ascii')[:120]}")
