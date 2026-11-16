"""
file3_html_scrapers.py - Direct High-Accuracy HTML District & Regional News Crawlers
Uses httpx and BeautifulSoup4 to crawl publishers directly covering regional and district portals:
(Sakshi, Eenadu, Andhra Jyothi, Namasthe Telangana, V6 Velugu)
Cigars 50+ verified live district sections across Telangana.
Output: List[Dict]
"""

import sys
import re
import html
import logging
import threading
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Set
from urllib.parse import urljoin

# Global cross-section URL cache to prevent redundant HTTP requests to shared sidebar/header links
_SHARED_SEEN_LOCK = threading.Lock()
_SHARED_SEEN_URLS: Set[str] = set()

# High-precision AP & Non-governance URL filter: intercepts all AP district slugs & entertainment
AP_AND_JUNK_URL_PATTERN = re.compile(
    r"(andhra-pradesh|andhrapradesh|amaravati|visakhapatnam|vijayawada|guntur|tirupati|chittoor|"
    r"kadapa|kurnool|anantapur|nellore|prakasam|srikakulam|vizianagaram|alluri|bapatla|palnadu|"
    r"eluru|konaseema|nandyal|annamayya|godavari|krishna|cinema|movies|tollywood|bollywood|"
    r"entertainment|sports|cricket|ipl|astrology|horoscope|rashi-phalalu|panchangam|epaper|videos|photos)",
    re.IGNORECASE
)

import httpx
from news_window import NEWS_WINDOW_HOURS
import trafilatura
from bs4 import BeautifulSoup
from district_data import DISTRICTS_33, detect_district_from_text
from constituency_mappings import classify_article_constituency
from deduplication import get_canonical_publisher, is_non_governance_content
from date_extractor import get_verified_article_datetime

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import random

logger = logging.getLogger("file3_html_scrapers")

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
]

def get_random_headers() -> Dict[str, str]:
    """Generates authentic browser headers with rotating User-Agent to prevent anti-bot IP blocks."""
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,te;q=0.8",
        "DNT": "1",
        "Upgrade-Insecure-Requests": "1"
    }

HEADERS = get_random_headers()


# Verified live targets across top regional newspapers & TV news networks
HTML_TARGETS = [
    # --- 1. SAKSHI (27 Verified Live District Sections + State Hub) ---
    {
        "publisher": "Sakshi",
        "base_url": "https://www.sakshi.com",
        "urls": [
            ("https://www.sakshi.com/telangana", "Statewide"),
            ("https://www.sakshi.com/telangana/adilabad", "Adilabad"),
            ("https://www.sakshi.com/telangana/bhadradri", "Bhadradri Kothagudem"),
            ("https://www.sakshi.com/telangana/hyderabad", "Hyderabad"),
            ("https://www.sakshi.com/telangana/jagtial", "Jagtial"),
            ("https://www.sakshi.com/telangana/jangaon", "Jangaon"),
            ("https://www.sakshi.com/telangana/jogulamba", "Jogulamba Gadwal"),
            ("https://www.sakshi.com/telangana/kamareddy", "Kamareddy"),
            ("https://www.sakshi.com/telangana/karimnagar", "Karimnagar"),
            ("https://www.sakshi.com/telangana/khammam", "Khammam"),
            ("https://www.sakshi.com/telangana/mahabubabad", "Mahabubabad"),
            ("https://www.sakshi.com/telangana/mahabubnagar", "Mahabubnagar"),
            ("https://www.sakshi.com/telangana/mancherial", "Mancherial"),
            ("https://www.sakshi.com/telangana/medak", "Medak"),
            ("https://www.sakshi.com/telangana/medchal", "Medchal-Malkajgiri"),
            ("https://www.sakshi.com/telangana/nagarkurnool", "Nagarkurnool"),
            ("https://www.sakshi.com/telangana/nalgonda", "Nalgonda"),
            ("https://www.sakshi.com/telangana/nirmal", "Nirmal"),
            ("https://www.sakshi.com/telangana/nizamabad", "Nizamabad"),
            ("https://www.sakshi.com/telangana/peddapalli", "Peddapalli"),
            ("https://www.sakshi.com/telangana/ranga-reddy", "Ranga Reddy"),
            ("https://www.sakshi.com/telangana/sangareddy", "Sangareddy"),
            ("https://www.sakshi.com/telangana/siddipet", "Siddipet"),
            ("https://www.sakshi.com/telangana/suryapet", "Suryapet"),
            ("https://www.sakshi.com/telangana/vikarabad", "Vikarabad"),
            ("https://www.sakshi.com/telangana/wanaparthy", "Wanaparthy"),
            ("https://www.sakshi.com/telangana/warangal", "Warangal"),
            ("https://www.sakshi.com/telangana/yadadri", "Yadadri Bhuvanagiri"),
            ("https://www.sakshi.com/telangana/jayashankar", "Jayashankar Bhupalpally"),
            ("https://www.sakshi.com/telangana/komaram-bheem", "Komaram Bheem Asifabad"),
            ("https://www.sakshi.com/telangana/rajanna", "Rajanna Sircilla"),
        ],
        "link_pattern": re.compile(r"/(telangana|telugu-news)/"),
        "deny_pattern": re.compile(r"/(movies|sports|national|international|cartoon|business|andhra-pradesh|family|lifestyle|health|recipes|viral|features|astrology|videos)/|/telangana/?$")
    },

    # --- 2. EENADU (10 Verified Live Regional District Hubs + State Portals) ---
    {
        "publisher": "Eenadu",
        "base_url": "https://www.eenadu.net",
        "urls": [
            ("https://www.eenadu.net/telangana", "Statewide"),
            ("https://www.eenadu.net/telangana/districts/adilabad", "Adilabad"),
            ("https://www.eenadu.net/telangana/districts/hyderabad", "Hyderabad"),
            ("https://www.eenadu.net/telangana/districts/karimnagar", "Karimnagar"),
            ("https://www.eenadu.net/telangana/districts/khammam", "Khammam"),
            ("https://www.eenadu.net/telangana/districts/mahbubnagar", "Mahabubnagar"),
            ("https://www.eenadu.net/telangana/districts/medak", "Medak"),
            ("https://www.eenadu.net/telangana/districts/nalgonda", "Nalgonda"),
            ("https://www.eenadu.net/telangana/districts/nizamabad", "Nizamabad"),
            ("https://www.eenadu.net/telangana/districts/warangal", "Warangal"),
        ],
        "link_pattern": re.compile(r"/(telangana|districts|telugu-news)/"),
        "deny_pattern": re.compile(r"/(movies|sports|world|india|editorial|business|andhra-pradesh|amaravati|chittoor|kadapa|kurnool|godavari|krishna|guntur|visakhapatnam|anantapur|nellore|prakasam|srikakulam|alluri|lifestyle|sunday|aliveni|astrology|videos)/|/(telangana|districts)/?$", re.IGNORECASE)
    },

    # --- 3. ANDHRA JYOTHI (10 Verified Live District Sections + State Portal) ---
    {
        "publisher": "Andhra Jyothi",
        "base_url": "https://www.andhrajyothy.com",
        "urls": [
            ("https://www.andhrajyothy.com/telangana", "Statewide"),
            ("https://www.andhrajyothy.com/telangana/adilabad", "Adilabad"),
            ("https://www.andhrajyothy.com/telangana/hyderabad", "Hyderabad"),
            ("https://www.andhrajyothy.com/telangana/karimnagar", "Karimnagar"),
            ("https://www.andhrajyothy.com/telangana/khammam", "Khammam"),
            ("https://www.andhrajyothy.com/telangana/mahbubnagar", "Mahabubnagar"),
            ("https://www.andhrajyothy.com/telangana/medak", "Medak"),
            ("https://www.andhrajyothy.com/telangana/nalgonda", "Nalgonda"),
            ("https://www.andhrajyothy.com/telangana/nizamabad", "Nizamabad"),
            ("https://www.andhrajyothy.com/telangana/rangareddy", "Ranga Reddy"),
            ("https://www.andhrajyothy.com/telangana/warangal", "Warangal"),
        ],
        "link_pattern": re.compile(r"/(telangana|districts)/"),
        "deny_pattern": re.compile(r"/(andhra-pradesh|cinema|national|international|sports|business|lifestyle|chitrajyothy|navya|astrology|videos)/|/telangana/?$")
    },

    # --- 4. NAMASTHE TELANGANA (State & District Portals) ---
    {
        "publisher": "Namasthe Telangana",
        "base_url": "https://www.ntnews.com",
        "urls": [
            ("https://www.ntnews.com/telangana", "Statewide"),
            ("https://www.ntnews.com/districts", "Statewide")
        ],
        "link_pattern": re.compile(r"/(telangana|districts)/"),
        "deny_pattern": re.compile(r"/(national|world|cinema|sports|andhra-pradesh|editorial|lifestyle|business|entertainment)/|/(telangana|districts)/?$")
    },

    # --- 5. V6 VELUGU (Telangana Direct News Stream) ---
    {
        "publisher": "V6 Velugu",
        "base_url": "https://www.v6velugu.com",
        "urls": [
            ("https://www.v6velugu.com/telangana-latest-news-updates", "Statewide")
        ],
        "link_pattern": re.compile(r"v6velugu\.com/[a-z0-9-]+"),
        "deny_pattern": re.compile(r"/(cinema|entertainment|sports|national|world|rashi-phalalu|astrology|lifestyle|telangana-latest-news-updates/?$|hyderabad-news/?$|districts/?$)")
    },

    # --- 6. TV9 TELUGU (State & Regional Desks) ---
    {
        "publisher": "TV9 Telugu",
        "base_url": "https://tv9telugu.com",
        "urls": [
            ("https://tv9telugu.com/telangana", "Statewide"),
            ("https://tv9telugu.com/telangana/hyderabad", "Hyderabad"),
            ("https://tv9telugu.com/telangana/warangal", "Warangal")
        ],
        "link_pattern": re.compile(r"tv9telugu\.com/(telangana|telugu-news)/"),
        "deny_pattern": re.compile(r"/(videos|photos|entertainment|movies|sports|national|world|astrology|lifestyle|andhra-pradesh|tollywood|bollywood|short-videos|topic|cricket)/|/telangana/?$")
    },

    # --- 7. NTV TELUGU (Telangana News Stream) ---
    {
        "publisher": "NTV Telugu",
        "base_url": "https://ntvtelugu.com",
        "urls": [
            ("https://ntvtelugu.com/telangana-news", "Statewide")
        ],
        "link_pattern": re.compile(r"ntvtelugu\.com/[a-z0-9-]+"),
        "deny_pattern": re.compile(r"/(entertainment|cinema|sports|national|international|astrology|specials|andhra-pradesh)/|/telangana-news/?$")
    },

    # --- 8. MANA TELANGANA (Regional Print & Web Stream) ---
    {
        "publisher": "Mana Telangana",
        "base_url": "https://www.manatelangana.news",
        "urls": [
            ("https://www.manatelangana.news/telangana-breaking-news", "Statewide"),
            ("https://www.manatelangana.news/telangana-news", "Statewide")
        ],
        "link_pattern": re.compile(r"manatelangana\.news/([a-z0-9-]+-)?\d+|manatelangana\.news/[a-z0-9-]+"),
        "deny_pattern": re.compile(r"/(cinema|sports|editorial|national|international|special|lifestyle|andhra|telangana-editorial-news|telangana-districts-news|andhra-pradesh-state-news|about-us|privacy-policy|terms|epaper|advertisement|e-paper)/|/telangana-news/?$")
    },

    # --- 9. 10TV TELUGU (State Broadcast Stream) ---
    {
        "publisher": "10TV Telugu",
        "base_url": "https://10tv.in",
        "urls": [
            ("https://10tv.in/telangana/", "Statewide")
        ],
        "link_pattern": re.compile(r"10tv\.in/(telangana|telugu-news)/"),
        "deny_pattern": re.compile(r"/(entertainment|cinema|sports|national|international|lifestyle|photo-gallery|photos|gallery|videos|andhra-pradesh)/|/telangana/?$")
    },

    # --- 10. HMTV LIVE (Breaking News Hub) ---
    {
        "publisher": "HMTV Live",
        "base_url": "https://www.hmtvlive.com",
        "urls": [
            ("https://www.hmtvlive.com/telangana", "Statewide")
        ],
        "link_pattern": re.compile(r"hmtvlive\.com/[a-z0-9-]+"),
        "deny_pattern": re.compile(r"/(entertainment|cinema|sports|national|international|lifestyle|andhra-pradesh|andhrapradesh|andhra|amaravati|visakhapatnam|vijayawada|guntur|tirupati|chittoor|kadapa|kurnool|anantapur|nellore|prakasam|srikakulam|vizianagaram|godavari|krishna|astrology|rashi-phalalu|epaper|videos|photos)/|/telangana/?$")
    }
]

def clean_text(text: str) -> str:
    """Cleans up text from HTML."""
    if not text:
        return ""
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()

def scrape_url(client: httpx.Client, target: Dict[str, Any], page_url: str, default_dist: str) -> List[Dict[str, Any]]:
    """Crawls a single URL, finds news article anchors, and extracts title, summary, link."""
    records = []
    raw_publisher = target["publisher"]
    base_url = target["base_url"]
    link_pattern = target["link_pattern"]
    deny_pattern = target.get("deny_pattern")
    
    try:
        resp = client.get(page_url, headers=get_random_headers(), timeout=12.0)
        if resp.status_code != 200:
            return records

        # If redirected to generic homepage root (/), skip to avoid duplicate homepage crawling
        final_path = str(resp.url.path).rstrip("/")
        if not final_path or final_path in ("", "/"):
            return records
            
        soup = BeautifulSoup(resp.text, "html.parser")

        # Look for article anchors (h1-h4 links, article cards)
        anchors = soup.find_all("a", href=True)
        for a in anchors:
            href = a["href"].strip()
            full_url = urljoin(base_url, href)
            
            # Check pattern match
            if not link_pattern.search(full_url):
                continue
            if deny_pattern and deny_pattern.search(full_url):
                continue
            # Instant rejection of AP districts, cinema, cricket, astrology from URL slug
            if AP_AND_JUNK_URL_PATTERN.search(full_url):
                continue

            # Thread-safe cross-page deduplication: skip if already processed by any thread
            with _SHARED_SEEN_LOCK:
                if full_url in _SHARED_SEEN_URLS:
                    continue
                _SHARED_SEEN_URLS.add(full_url)
                
            # Extract title
            title = clean_text(a.get_text())
            if not title or len(title) < 20 or len(title) > 280:
                # Check for child heading or title attribute
                heading = a.find(["h1", "h2", "h3", "h4", "p", "span"])
                if heading:
                    title = clean_text(heading.get_text())
                if not title or len(title) < 20:
                    title = clean_text(a.get("title", ""))
                    
            if not title or len(title) < 20:
                continue
                
            # Filter out generic UI boilerplate
            if any(term in title.lower() for term in [
                "privacy policy", "terms of", "contact us", "epaper", "about us",
                "view more", "more news", "advertisement", "all rights reserved"
            ]):
                continue

            # Strict Governance Filter: Skip AP, Cinema, Sports, Junk before network requests
            if is_non_governance_content(title, "", full_url):
                continue

            # Strict verification of true publication datetime (MAX_AGE_HOURS = 36)
            pub_dt, is_fresh = get_verified_article_datetime(a, full_url, client=client, max_age_hours=NEWS_WINDOW_HOURS)
            if not is_fresh or not pub_dt:
                # Discard non-fresh or unverified stories (NEVER fall back to now())
                continue

            # Extract summary: look nearby or use title
            summary = title
            parent = a.find_parent(["article", "div", "li"])
            if parent:
                p_tag = parent.find("p")
                if p_tag and len(p_tag.get_text().strip()) > 30:
                    summary = clean_text(p_tag.get_text())
                    
            # District & Constituency detection
            combined_text = f"{title} {summary} {full_url}"
            district = detect_district_from_text(combined_text, default=default_dist)
            c_name, c_dist, all_c, leaders, civic_c = classify_article_constituency(
                title, summary, "", district, return_all=True
            )
            final_dist = c_dist if c_dist and c_dist != "Statewide" else district
            
            # Canonical publisher normalization
            c_pub = get_canonical_publisher(raw_publisher, full_url)

            records.append({
                "title": title,
                "district": final_dist,
                "constituency": c_name,
                "constituencies": all_c,
                "civic_constituencies": civic_c,
                "state": "Telangana",
                "summary": summary[:400],
                "publisher": c_pub,
                "url": full_url,
                "published_at": pub_dt.isoformat()
            })

            # Cap each section URL to top 25 fresh stories
            if len(records) >= 25:
                break
            
    except Exception as e:
        logger.debug(f"Error scraping {raw_publisher} ({page_url}): {e}")
        
    return records

def collect_html_scrapers(max_workers: int = 16) -> List[Dict[str, Any]]:
    """
    Main entrypoint for Layer 1 HTML Crawlers.
    Crawls Sakshi, Eenadu, Andhra Jyothi, Namasthe Telangana, and V6 Velugu concurrently.
    Returns: List[Dict]
    """
    logger.info("Starting Layer 1 HTML Crawlers across 50+ verified regional sections...")
    with _SHARED_SEEN_LOCK:
        _SHARED_SEEN_URLS.clear()
    all_records = []
    
    crawl_tasks = []
    for target in HTML_TARGETS:
        for page_url, default_dist in target["urls"]:
            crawl_tasks.append((target, page_url, default_dist))
            
    with httpx.Client(headers=HEADERS, follow_redirects=True) as client:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_url = {
                executor.submit(scrape_url, client, target, url, dist): (target["publisher"], url)
                for target, url, dist in crawl_tasks
            }
            for future in as_completed(future_to_url):
                pub, url = future_to_url[future]
                try:
                    recs = future.result()
                    if recs:
                        all_records.extend(recs)
                        logger.info(f"Crawled {len(recs)} articles from {pub} ({url})")
                except Exception as exc:
                    logger.error(f"Error crawling {pub} ({url}): {exc}")
                    
    logger.info(f"HTML Crawlers complete. Total raw records: {len(all_records)}")
    return all_records

def extract_full_article_content(url: str) -> Dict[str, Any]:
    """
    Uses Trafilatura to cleanly extract full article text, published date,
    and metadata without ads, comments, or UI clutter.
    """
    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return {}
        text = trafilatura.extract(downloaded, include_comments=False, output_format="txt")
        meta = trafilatura.extract_metadata(downloaded)
        return {
            "title": meta.title if meta else None,
            "date": meta.date if meta else None,
            "author": meta.author if meta else None,
            "text": text or ""
        }
    except Exception as e:
        logger.debug(f"Trafilatura extraction failed for {url}: {e}")
        return {}

if __name__ == "__main__":
    records = collect_html_scrapers()
    print(f"Collected {len(records)} records from HTML scrapers.")
    if records:
        print("\nSample Record:")
        for k, v in records[0].items():
            val_str = str(v)
            try:
                print(f"  {k}: {val_str[:120]}")
            except Exception:
                print(f"  {k}: {val_str.encode('ascii', errors='replace').decode('ascii')[:120]}")
