"""
file1_google_rss.py - High-Accuracy Google News RSS Ingestion Engine
Constructs bilingual (Native Telugu Script + Popular Aliases) Google News RSS queries
across all 33 Telangana districts. Includes strict false-positive district verification
and canonical publisher normalization.
Output: List[Dict]
"""

import sys
import re
import html
import logging
import urllib.parse
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any

import httpx
import feedparser
from district_data import DISTRICTS_33, DISTRICT_KEYWORDS, detect_district_from_text
from deduplication import get_canonical_publisher, is_non_governance_content
from constituency_mappings import CONSTITUENCY_TELUGU, classify_article_constituency

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("file1_google_rss")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

# Strict filters against spam, price tickers, and non-civic categories
UNRELATED_TITLE_PATTERN = re.compile(
    r'(Silver Rate Today|Gold Rate Today|Todays Silver Price|Todays Gold Price|బంగారం ధరలు|వెండి ధరలు|'
    r'ePaper - |e-Paper|ePaper|'
    r'రాశి ఫలాలు|రాశిఫలాలు|గ్రహాల సంచారం|పంచాంగం|Horoscope|Astrology|'
    r'బాక్సాఫీస్ కలెక్షన్లు|సినిమా రివ్యూ|Movie Review|Box Office Collection|'
    r'కుప్పకూలిన బంగారు గని)',
    re.IGNORECASE
)

UNRELATED_URL_PATTERN = re.compile(
    r'(/international/|/world/|/sports/|/cricket/|/ipl/|/cinema/|/movies/|/entertainment/|/astrology/|/horoscope/|/rashi-phalalu/|/epaper/|'
    r'andhra-pradesh|andhrapradesh|amaravati|vijayawada|visakhapatnam|guntur|tirupati|chittoor|kadapa|kurnool|anantapur|nellore|prakasam|srikakulam|vizianagaram|alluri|bapatla|palnadu|eluru|konaseema|nandyal|annamayya)',
    re.IGNORECASE
)

# High-accuracy bilingual search terms (Native Telugu Script + Journalistic Aliases)
DISTRICT_SEARCH_TERMS: Dict[str, Dict[str, str]] = {
    "Adilabad": {"en": "Adilabad", "te": "ఆదిలాబాద్"},
    "Bhadradri Kothagudem": {"en": '(Kothagudem OR Bhadradri OR "Bhadradri Kothagudem")', "te": "(కొత్తగూడెం OR భద్రాద్రి)"},
    "Hanumakonda": {"en": "(Hanumakonda OR Hanamkonda)", "te": "(హన్మకొండ OR హనుమకొండ)"},
    "Hyderabad": {"en": "Hyderabad", "te": "హైదరాబాద్"},
    "Jagtial": {"en": "Jagtial", "te": "జగిత్యాల"},
    "Jangaon": {"en": "Jangaon", "te": "(జనగాం OR జనగామ)"},
    "Jayashankar Bhupalpally": {"en": '(Bhupalpally OR Jayashankar OR "Jayashankar Bhupalpally")', "te": "(భూపాలపల్లి OR జయశంకర్)"},
    "Jogulamba Gadwal": {"en": '(Gadwal OR Jogulamba OR "Jogulamba Gadwal")', "te": "(గద్వాల OR జోగులాంబ)"},
    "Kamareddy": {"en": "Kamareddy", "te": "కామారెడ్డి"},
    "Karimnagar": {"en": "Karimnagar", "te": "కరీంనగర్"},
    "Khammam": {"en": "Khammam", "te": "ఖమ్మం"},
    "Komaram Bheem Asifabad": {"en": '(Asifabad OR "Komaram Bheem")', "te": "(ఆసిఫాబాద్ OR కొమరం భీం)"},
    "Mahabubabad": {"en": "Mahabubabad", "te": "మహబూబాబాద్"},
    "Mahabubnagar": {"en": "(Mahabubnagar OR Palamuru)", "te": "(మహబూబ్‌నగర్ OR పాలమూరు)"},
    "Mancherial": {"en": "Mancherial", "te": "మంచిర్యాల"},
    "Medak": {"en": "Medak", "te": "మెదక్"},
    "Medchal-Malkajgiri": {"en": "(Medchal OR Malkajgiri)", "te": "(మేడ్చల్ OR మల్కాజ్‌గిరి)"},
    "Mulugu": {"en": "Mulugu", "te": "ములుగు"},
    "Nagarkurnool": {"en": "Nagarkurnool", "te": "నాగర్‌కర్నూల్"},
    "Nalgonda": {"en": "Nalgonda", "te": "నల్గొండ"},
    "Narayanpet": {"en": "Narayanpet", "te": "నారాయణపేట"},
    "Nirmal": {"en": "Nirmal", "te": "నిర్మల్"},
    "Nizamabad": {"en": "Nizamabad", "te": "నిజామాబాద్"},
    "Peddapalli": {"en": "Peddapalli", "te": "పెద్దపల్లి"},
    "Rajanna Sircilla": {"en": '(Sircilla OR "Rajanna Sircilla")', "te": "(సిరిసిల్ల OR రాజన్న సిరిసిల్ల)"},
    "Ranga Reddy": {"en": '("Ranga Reddy" OR Rangareddy)', "te": "రంగారెడ్డి"},
    "Sangareddy": {"en": "Sangareddy", "te": "సంగారెడ్డి"},
    "Siddipet": {"en": "Siddipet", "te": "సిద్దిపేట"},
    "Suryapet": {"en": "Suryapet", "te": "సూర్యాపేట"},
    "Vikarabad": {"en": "Vikarabad", "te": "వికారాబాద్"},
    "Wanaparthy": {"en": "Wanaparthy", "te": "వనపర్తి"},
    "Warangal": {"en": "Warangal", "te": "వరంగల్"},
    "Yadadri Bhuvanagiri": {"en": "(Yadadri OR Bhongir OR Bhuvanagiri)", "te": "(యాదాద్రి OR భువనగిరి)"}
}

def clean_html(raw_html: str) -> str:
    """Removes HTML tags and cleans up entities."""
    if not raw_html:
        return ""
    clean = re.sub(r"<[^>]+>", " ", raw_html)
    clean = html.unescape(clean)
    return re.sub(r"\s+", " ", clean).strip()

def extract_publisher(entry: Any, full_title: str, link: str = "") -> tuple[str, str]:
    """
    Extracts publisher name and cleans the headline.
    Google News RSS titles are formatted as: 'Story Headline - Publisher Name'
    """
    publisher = "Google News"
    title = full_title
    
    # Try entry source title first
    if hasattr(entry, "source") and isinstance(entry.source, dict) and entry.source.get("title"):
        publisher = entry.source.get("title").strip()
    
    # Check for trailing ' - Publisher'
    if " - " in title:
        parts = title.rsplit(" - ", 1)
        if len(parts) == 2 and len(parts[1].strip()) < 40:
            title = parts[0].strip()
            if publisher == "Google News":
                publisher = parts[1].strip()
                
    canonical_pub = get_canonical_publisher(publisher, link)
    return clean_html(title), canonical_pub

def verify_and_assign_district(target_district: str, text: str) -> str:
    """
    Verifies that the article genuinely refers to the queried district.
    If the target district or its sub-towns are not mentioned, it detects
    the actual district mentioned, or defaults to Statewide.
    """
    text_lower = text.lower()
    
    # 1. Check if the target district or its known sub-towns/keywords match
    kws = DISTRICT_KEYWORDS.get(target_district, [])
    for kw in kws:
        if kw.lower() in text_lower:
            return target_district
            
    # 2. If the story didn't match the query district, check where it truly belongs
    detected = detect_district_from_text(text, default="")
    if detected:
        return detected
        
    # 3. If no specific district is mentioned, accurately mark as Statewide
    return "Statewide"

def fetch_district_rss(client: httpx.Client, district: str, lang: str = "en") -> List[Dict[str, Any]]:
    """Fetches Google News RSS for a single district in native Telugu or English with alias matching."""
    records = []
    
    now_utc = datetime.now(timezone.utc)
    MAX_AGE_HOURS = 30  # Strictly today / past 24-30 hours

    terms = DISTRICT_SEARCH_TERMS.get(district, {"en": district, "te": district})

    if lang == "te":
        # Native Telugu script query
        query = f"{terms['te']} వార్తలు when:1d"
        url = f"https://news.google.com/rss/search?q={urllib.parse.quote(query)}&hl=te&gl=IN&ceid=IN:te"
    else:
        # English query with popular aliases
        query = f"{terms['en']} Telangana when:1d"
        url = f"https://news.google.com/rss/search?q={urllib.parse.quote(query)}&hl=en-IN&gl=IN&ceid=IN:en"
        
    try:
        resp = client.get(url, timeout=12.0)
        if resp.status_code != 200:
            logger.warning(f"Google RSS error for {district} ({lang}): HTTP {resp.status_code}")
            return records
            
        feed = feedparser.parse(resp.text)
        
        for entry in feed.entries[:25]:  # Capture top 25 fresh items per district query
            raw_title = getattr(entry, "title", "")
            if not raw_title:
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
                continue  # Discard past or unverified news
                
            link = getattr(entry, "link", "")
            clean_title, publisher = extract_publisher(entry, raw_title, link)
            summary = clean_html(getattr(entry, "summary", "") or clean_title)

            # Skip price tickers, epaper, spam, and non-civic categories
            if UNRELATED_TITLE_PATTERN.search(clean_title) or UNRELATED_URL_PATTERN.search(link):
                continue
            
            # Accurate district verification
            combined_text = f"{clean_title} {summary}"
            assigned_district = verify_and_assign_district(district, combined_text)
                    
            record = {
                "title": clean_title,
                "district": assigned_district,
                "state": "Telangana",
                "summary": summary[:400],
                "publisher": publisher,
                "url": link,
                "published_at": published_dt.isoformat()
            }
            records.append(record)
            
    except Exception as e:
        logger.warning(f"Failed to fetch Google RSS for {district} ({lang}): {e}")
        
    return records

def fetch_constituency_rss(client: httpx.Client, constituency: str, te_keyword: str) -> List[Dict[str, Any]]:
    """Fetches Google News RSS for a specific assembly constituency in native Telugu."""
    records = []
    now_utc = datetime.now(timezone.utc)
    MAX_AGE_HOURS = 36
    
    query = f"{te_keyword} వార్తలు when:1d"
    url = f"https://news.google.com/rss/search?q={urllib.parse.quote(query)}&hl=te&gl=IN&ceid=IN:te"
    
    try:
        resp = client.get(url, timeout=10.0)
        if resp.status_code != 200:
            return records
            
        feed = feedparser.parse(resp.text)
        for entry in feed.entries[:15]:
            raw_title = getattr(entry, "title", "")
            if not raw_title:
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
                continue

            link = getattr(entry, "link", "")
            clean_title, publisher = extract_publisher(entry, raw_title, link)
            summary = clean_html(getattr(entry, "summary", "") or clean_title)

            # Skip price tickers, epaper, spam, AP, Cinema, Sports, and non-civic categories
            if UNRELATED_TITLE_PATTERN.search(clean_title) or UNRELATED_URL_PATTERN.search(link) or is_non_governance_content(clean_title, summary, link):
                continue
            
            c_res = classify_article_constituency(clean_title, summary, "", return_all=True)
            prim_const, prim_dist, all_consts, _, civic_consts = c_res
            
            is_matched = (te_keyword in clean_title or te_keyword in summary)
            if constituency not in civic_consts and is_matched:
                civic_consts.append(constituency)
            if constituency not in all_consts and constituency in civic_consts:
                all_consts.append(constituency)

            # If the article has NO mention of this constituency and no civic match,
            # Google News returned generic trending news - discard it!
            if not is_matched and prim_const == 'Statewide' and not civic_consts:
                continue

            records.append({
                "title": clean_title,
                "district": prim_dist,
                "constituency": prim_const if prim_const != 'Statewide' else (constituency if is_matched else 'Statewide'),
                "constituencies": all_consts,
                "civic_constituencies": civic_consts,
                "state": "Telangana",
                "summary": summary[:400],
                "publisher": publisher,
                "url": link,
                "published_at": published_dt.isoformat()
            })
    except Exception as e:
        logger.debug(f"Failed constituency RSS for {constituency}: {e}")
        
    return records

# People we follow by NAME (their news is tagged to the given constituency). (constituency, Telugu name)
WATCHED_PEOPLE = [("Malkajgiri", "ఈటల రాజేందర్")]


def collect_google_rss(max_workers: int = 12) -> List[Dict[str, Any]]:
    """
    Main entrypoint for Layer 1 Google RSS collector.
    Concurrently queries all 33 Telangana districts + all 119 Assembly Constituencies in native Telugu and English.
    Returns: List[Dict]
    """
    logger.info("Starting high-accuracy Google RSS collection across all 33 districts & 119 constituencies...")
    all_records = []
    
    unique_constituencies = {}
    for te_kw, canon in CONSTITUENCY_TELUGU.items():
        if canon not in unique_constituencies:
            unique_constituencies[canon] = te_kw

    tasks = []
    with httpx.Client(headers=HEADERS, follow_redirects=True) as client:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # 1. Query 33 Districts in English and Telugu
            for district in DISTRICTS_33:
                tasks.append(executor.submit(fetch_district_rss, client, district, "en"))
                tasks.append(executor.submit(fetch_district_rss, client, district, "te"))
                
            # 2. Query 119 Constituencies in Native Telugu Script
            for canon, te_kw in unique_constituencies.items():
                tasks.append(executor.submit(fetch_constituency_rss, client, canon, te_kw))

            # 3. People followed by name (e.g. an MP whose area is a constituency)
            for canon, name_kw in WATCHED_PEOPLE:
                tasks.append(executor.submit(fetch_constituency_rss, client, canon, name_kw))

            for future in as_completed(tasks):
                try:
                    res = future.result()
                    all_records.extend(res)
                except Exception as exc:
                    logger.error(f"Worker generated exception: {exc}")
                    
    logger.info(f"Google RSS collection complete. Total raw records fetched: {len(all_records)}")
    return all_records

if __name__ == "__main__":
    records = collect_google_rss()
    print(f"Collected {len(records)} records from Google RSS.")
    if records:
        print("\nSample Record:")
        for k, v in records[0].items():
            val_str = str(v)
            try:
                print(f"  {k}: {val_str[:120]}")
            except Exception:
                print(f"  {k}: {val_str.encode('ascii', errors='replace').decode('ascii')[:120]}")
