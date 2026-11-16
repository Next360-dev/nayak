"""
deduplication.py - Layer 2: Clustering & Deduplication Engine
Partitions by district. Uses SequenceMatcher(ratio >= 0.70) to drop repeat posts
from the same outlet while merging distinct outlets into a single canonical event:
sources: [{"publisher": name, "url": link}].
Output: List[ClusteredDict]
"""

import sys
import re
from urllib.parse import urlparse
import urllib.parse
from difflib import SequenceMatcher
from functools import lru_cache
from datetime import datetime, timezone
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed

from constituency_mappings import classify_article_constituency, get_constituencies_for_district, CONSTITUENCY_TELUGU
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Tracking parameters to strip from URLs
TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "oc", "fbclid", "gclid", "ref", "source", "outputType"
}

PUBLISHER_NORMALIZATION_MAP = {
    # Andhra Jyothi / ABN
    "andhrajyothy": "Andhra Jyothi",
    "andhra jyothi": "Andhra Jyothi",
    "andhrajyothy.com": "Andhra Jyothi",
    "abn": "Andhra Jyothi",
    "abn andhra jyothi": "Andhra Jyothi",
    
    # HMTV
    "hmtv": "HMTV Live",
    "hmtv live": "HMTV Live",
    "hmtvlive": "HMTV Live",
    "hmtvlive.com": "HMTV Live",

    # The Hindu
    "the hindu": "The Hindu",
    "the hindu telangana": "The Hindu",
    "the hindu - hyderabad": "The Hindu",
    "thehindu": "The Hindu",
    "thehindu.com": "The Hindu",

    # Eenadu
    "eenadu": "Eenadu",
    "eenadu telangana": "Eenadu",
    "eenadu.net": "Eenadu",

    # Sakshi
    "sakshi": "Sakshi",
    "sakshi.com": "Sakshi",
    "sakshi education": "Sakshi",
    "education.sakshi.com": "Sakshi",

    # Namasthe Telangana / NT News
    "namasthe telangana": "Namasthe Telangana",
    "nt news": "Namasthe Telangana",
    "ntnews": "Namasthe Telangana",
    "ntnews.com": "Namasthe Telangana",

    # TV9 Telugu
    "tv9": "TV9 Telugu",
    "tv9 telugu": "TV9 Telugu",
    "tv9telugu": "TV9 Telugu",
    "tv9telugu.com": "TV9 Telugu",

    # NTV Telugu
    "ntv": "NTV Telugu",
    "ntv telugu": "NTV Telugu",
    "ntvtelugu": "NTV Telugu",
    "ntvtelugu.com": "NTV Telugu",

    # V6 Velugu
    "v6": "V6 Velugu",
    "v6 velugu": "V6 Velugu",
    "v6velugu": "V6 Velugu",
    "v6velugu.com": "V6 Velugu",

    # Telangana Today
    "telangana today": "Telangana Today",
    "telanganatoday": "Telangana Today",
    "telanganatoday.com": "Telangana Today",

    # Times of India
    "times of india": "Times of India",
    "the times of india": "Times of India",
    "times of india - hyderabad": "Times of India",
    "times of india - telangana": "Times of India",
    "timesofindia": "Times of India",
    "timesofindia.indiatimes.com": "Times of India",

    # Samayam Telugu
    "samayam telugu": "Samayam Telugu",
    "samayam telugu - telangana": "Samayam Telugu",
    "telugu.samayam.com": "Samayam Telugu",

    # OneIndia Telugu
    "oneindia telugu": "Oneindia Telugu",
    "oneindia": "Oneindia Telugu",
    "telugu.oneindia.com": "Oneindia Telugu",

    # Asianet News
    "asianet news telugu": "Asianet News Telugu",
    "asianet news": "Asianet News Telugu",
    "telugu.asianetnews.com": "Asianet News Telugu",

    # News18 Telugu
    "news18 telugu": "News18 Telugu",
    "news18": "News18 Telugu",
    "telugu.news18.com": "News18 Telugu",

    # ABP Desam
    "abp desam": "ABP Desam",
    "telugu.abplive.com": "ABP Desam",

    # Mana Telangana
    "mana telangana": "Mana Telangana",
    "mana telangana epaper": "Mana Telangana",
    "manatelangana.news": "Mana Telangana",

    # ETV Bharat
    "etv bharat": "ETV Bharat",
    "etvbharat.com": "ETV Bharat",

    # Deccan Chronicle
    "deccan chronicle": "Deccan Chronicle",
    "deccanchronicle.com": "Deccan Chronicle",

    # The Siasat Daily
    "the siasat daily": "The Siasat Daily",
    "siasat": "The Siasat Daily",
    "siasat.com": "The Siasat Daily",

    # Vaartha
    "vaartha": "Vaartha",
    "vaartha.com": "Vaartha",

    # Nava Telangana
    "nava telangana": "Nava Telangana",
    "navatelangana.com": "Nava Telangana",

    # Disha Daily
    "disha daily": "Disha Daily",
    "dishadaily.com": "Disha Daily",

    # 10TV Telugu
    "10tv": "10TV Telugu",
    "10tv telugu": "10TV Telugu",
    "10tv.in": "10TV Telugu",

    # Tupaki
    "tupaki": "Tupaki",
    "tupaki english": "Tupaki",
    "english.tupaki.com": "Tupaki",

    # AP7AM
    "ap7am": "AP7AM",
    "ap7am.com": "AP7AM",

    # Telugu360
    "telugu360": "Telugu360",
    "telugu360.com": "Telugu360",

    # The New Indian Express
    "the new indian express": "The New Indian Express",
    "new indian express": "The New Indian Express",
    "newindianexpress.com": "The New Indian Express",

    # The Indian Express
    "the indian express": "The Indian Express",
    "indian express": "The Indian Express",
    "indianexpress.com": "The Indian Express",

    # Hindustan Times
    "hindustan times": "Hindustan Times",
    "hindustantimes.com": "Hindustan Times",

    # Daily Pioneer
    "daily pioneer": "Daily Pioneer",
    "dailypioneer.com": "Daily Pioneer",

    # Hyderabad Mail
    "hyderabad mail": "Hyderabad Mail",
    "hyderabadmail.com": "Hyderabad Mail",
}

DOMAIN_TO_PUBLISHER = [
    ("andhrajyothy.com", "Andhra Jyothi"),
    ("hmtvlive.com", "HMTV Live"),
    ("thehindu.com", "The Hindu"),
    ("eenadu.net", "Eenadu"),
    ("sakshi.com", "Sakshi"),
    ("ntnews.com", "Namasthe Telangana"),
    ("tv9telugu.com", "TV9 Telugu"),
    ("ntvtelugu.com", "NTV Telugu"),
    ("v6velugu.com", "V6 Velugu"),
    ("telanganatoday.com", "Telangana Today"),
    ("timesofindia.indiatimes.com", "Times of India"),
    ("samayam.com", "Samayam Telugu"),
    ("oneindia.com", "Oneindia Telugu"),
    ("asianetnews.com", "Asianet News Telugu"),
    ("news18.com", "News18 Telugu"),
    ("abplive.com", "ABP Desam"),
    ("manatelangana.news", "Mana Telangana"),
    ("etvbharat.com", "ETV Bharat"),
    ("deccanchronicle.com", "Deccan Chronicle"),
    ("siasat.com", "The Siasat Daily"),
    ("vaartha.com", "Vaartha"),
    ("navatelangana.com", "Nava Telangana"),
    ("dishadaily.com", "Disha Daily"),
    ("10tv.in", "10TV Telugu"),
    ("tupaki.com", "Tupaki"),
    ("ap7am.com", "AP7AM"),
    ("telugu360.com", "Telugu360"),
    ("newindianexpress.com", "The New Indian Express"),
    ("indianexpress.com", "The Indian Express"),
    ("hindustantimes.com", "Hindustan Times"),
    ("dailypioneer.com", "Daily Pioneer"),
    ("hyderabadmail.com", "Hyderabad Mail"),
]

def get_canonical_publisher(pub_name: str, url: str = "") -> str:
    """
    Returns a unified, clean canonical publisher name.
    Resolves variations such as 'The Hindu Telangana', 'Andhrajyothy',
    'hmtvlive.com' to their standard official publisher brand.
    """
    if not pub_name and not url:
        return "News Source"
        
    p_clean = (pub_name or "").strip().lower()
    
    # 1. Exact match in normalization map
    if p_clean in PUBLISHER_NORMALIZATION_MAP:
        return PUBLISHER_NORMALIZATION_MAP[p_clean]
        
    # 2. Check URL domain
    url_lower = (url or "").lower()
    for domain, canonical in DOMAIN_TO_PUBLISHER:
        if domain in url_lower:
            return canonical
            
    # 3. Fuzzy sub-phrase check in publisher name
    for key, canonical in PUBLISHER_NORMALIZATION_MAP.items():
        if len(key) > 3 and (key in p_clean or p_clean in key):
            return canonical
            
    # Fallback to original cleaned publisher name
    return pub_name.strip() if pub_name else "News Source"

def is_direct_source_url(url: str) -> bool:
    """Returns True if the URL points directly to publisher domain rather than an aggregator/redirector like Google News."""
    if not url:
        return False
    u = url.lower()
    return "news.google.com" not in u and "google.com" not in u

def deduplicate_sources(sources_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Deduplicates a list of source dictionaries so each canonical publisher
    and each canonical URL appears at most once.
    Prioritizes direct publisher URLs over Google News aggregator redirect URLs.
    """
    if not sources_list:
        return []
        
    sorted_sources = sorted(
        sources_list,
        key=lambda s: 0 if (isinstance(s, dict) and is_direct_source_url(s.get("url", ""))) else 1
    )
        
    unique_sources = []
    seen_publishers = set()
    seen_urls = set()
    
    for s in sorted_sources:
        if not isinstance(s, dict):
            continue
        raw_pub = s.get("publisher", "")
        raw_url = s.get("url", "")
        
        c_pub = get_canonical_publisher(raw_pub, raw_url)
        c_url = canonicalize_url(raw_url)
        
        # If we already have this publisher or URL, skip duplicate
        if c_pub in seen_publishers or (c_url and c_url in seen_urls):
            continue
            
        seen_publishers.add(c_pub)
        if c_url:
            seen_urls.add(c_url)
            
        unique_sources.append({
            "publisher": c_pub,
            "url": raw_url or c_url
        })
        
    return unique_sources

def canonicalize_url(url: str) -> str:
    """Normalizes URL by stripping tracking parameters, anchors, and trailing slashes."""
    if not url:
        return ""
    try:
        parsed = urllib.parse.urlparse(url)
        # Filter query params
        q_params = urllib.parse.parse_qsl(parsed.query)
        clean_q = [(k, v) for k, v in q_params if k.lower() not in TRACKING_PARAMS]
        clean_query = urllib.parse.urlencode(clean_q)
        # Normalize path
        clean_path = parsed.path.rstrip("/")
        normalized = urllib.parse.urlunparse((
            parsed.scheme.lower(),
            parsed.netloc.lower(),
            clean_path,
            "",
            clean_query,
            ""
        ))
        return normalized
    except Exception:
        return url.strip()

# ============================================================
# COMPREHENSIVE GOVERNANCE & TELANGANA PURITY FILTERS
# Strictly prevents non-Telangana (AP, Cinema, Sports, Junk)
# content from ever being clustered or persisted to the DB.
# ============================================================

TG_PROTECTED_PATTERN = re.compile(
    r'(తెలంగాణ|హైదరాబాద్|భాగ్యనగరం|సికింద్రాబాద్|చిక్కడపల్లి|రేవంత్|కేసీఆర్|కేటీఆర్|హరీష్ రావు|భట్టి విక్రమార్క|'
    r'ఉత్తమ్ కుమార్|కోమటిరెడ్డి|దామోదర|శ్రీధర్ బాబు|సీతక్క|తుమ్మల|పొంగులేటి|జూపల్లి|కొండా సురేఖ|'
    r'బండి సంజయ్|కిషన్ రెడ్డి|అసదుద్దీన్|అక్బరుద్దీన్|రాజాసింగ్|ఈటల|ఈటెల|కవిత|గల్ఫ్‌|'
    r'ఆదిలాబాద్|కొత్తగూడెం|భద్రాద్రి|భద్రాచలం|హన్మకొండ|హనుమకొండ|జగిత్యాల|జనగామ|జనగాం|భూపాలపల్లి|'
    r'గద్వాల|కామారెడ్డి|కరీంనగర్|ఖమ్మం|ఆసిఫాబాద్|మహబూబాబాద్|మహబూబ్ నగర్|పాలమూరు|మంచిర్యాల|'
    r'మెదక్|మేడ్చల్|మల్కాజిగిరి|ములుగు|నాగర్ కర్నూల్|నాగర్‌కర్నూల్|నల్గొండ|నారాయణపేట|నిర్మల్|నిజామాబాద్|'
    r'పెద్దపల్లి|సిరిసిల్ల|రంగారెడ్డి|సంగారెడ్డి|సిద్దిపేట|సూర్యాపేట|వికారాబాద్|వనపర్తి|వరంగల్|భువనగిరి|యాదాద్రి|'
    r'దేవరకొండ|కొడంగల్|గజ్వేల్|హుజూరాబాద్|మునుగోడు|ఆలేరు|తుంగతుర్తి|పాలకుర్తి|వర్ధన్నపేట|జడ్చర్ల|షాద్‌నగర్|ఇబ్రహీంపట్నం|'
    r'ఆర్టీసీ|rtc|tg rtc|tsrtc|tgspc|tspsc|హైడ్రా|hydraa|మూసీ|సింగరేణి|కాళేశ్వరం|ధరణి|బీఆర్ఎస్|brs|'
    r'telangana|hyderabad|secunderabad|revanth|kcr|ktr|harish rao|singareni)',
    re.IGNORECASE
)

CINEMA_PATTERN = re.compile(
    r'/(movies|entertainment|cinema|tollywood|bollywood|photo-gallery|photos|gallery|videos|chitrajyothy|navya)/|'
    r'(సినిమా రివ్యూ|మూవీ రివ్యూ|బాక్సాఫీస్|బాక్సాఫీస్ కలెక్షన్లు|బిగ్‌బాస్|బిగ్ బాస్|ఓటీటీ రిలీజ్|'
    r'టీజర్ రిలీజ్|ట్రైలర్ రిలీజ్|ఫస్ట్ లుక్|గ్లింప్స్ రిలీజ్|హీరోయిన్ అందాల|హాట్ ఫొటోలు|'
    r'టాలీవుడ్ న్యూస్|బాలీవుడ్ న్యూస్|కోలీవుడ్|జైలర్ 2|పుష్ప 2|పుష్ప-2|గేమ్ ఛేంజర్|'
    r'సినిమా కబుర్లు|సినీ విశేషాలు|బ్యూటీ టిప్స్|అందం రహస్యం|మూవీ అప్‌డేట్|టాలీవుడ్|బాలీవుడ్|'
    r'హీరోయిన్|దర్శకుడు|నిర్మాత|ఓటీటీలో|థియేటర్లలో విడుదల|'
    r'\btollywood\b|\bbollywood\b|\bbox office\b|\bmovie review\b|\bbiggboss\b|\bott release\b)',
    re.IGNORECASE
)

SPORTS_PATTERN = re.compile(
    r'/(sports|cricket|ipl|football|tennis|badminton|olympics)/|'
    r'(టోర్నీ|టోర్నమెంట్|హ్యాండ్‌బాల్|వాలీబాల్|ఖోఖో|క్రికెట్|వరల్డ్ కప్|ఐపీఎల్|డబ్ల్యూటీసీ|టెస్ట్ మ్యాచ్|వన్డే మ్యాచ్|టీ20|'
    r'రోహిత్ శర్మ|విరాట్ కోహ్లీ|ఎంఎస్ ధోని|స్మృతి మంధాన|హర్మన్‌ప్రీత్|శ్రేయస్ అయ్యర్|'
    r'హార్దిక్ పాండ్యా|జస్ప్రీత్ బుమ్రా|రిషబ్ పంత్|సూర్యకుమార్ యాదవ్|భారత్ వర్సెస్|పాకిస్థాన్ మ్యాచ్|'
    r'వెస్టిండీస్|ఆస్ట్రేలియా|ఇంగ్లాండ్|సౌతాఫ్రికా|న్యూజిలాండ్|శ్రీలంక|బంగ్లాదేశ్|'
    r'సెంచరీ|హాఫ్ సెంచరీ|వికెట్లు|సిక్సర్లు|బ్యాటర్|బౌలర్|టాస్ గెలిచి|వికెట్ కీపర్|'
    r'\bipl\b|\bworld cup\b|\bcricket\b|\bwtc\b|\brohit sharma\b|\bvirat kohli\b|\bbcci\b|\bodi\b|\bt20\b)',
    re.IGNORECASE
)

JUNK_PATTERN = re.compile(
    r'/(astrology|horoscope|rashi-phalalu|epaper)/|'
    r'(క్వింటాల్\S*\s*(పత్తి|మిర్చి|పసుపు|వరి|కందులు|సోయాబీన్|మొక్కజొన్న|శనగ)\S*\s*రూ|(పత్తి|మిర్చి|పసుపు|కందులు|సోయాబీన్|మొక్కజొన్న)\S*\s*క్వింటాల్\S*\s*రూ|'
    r'రాశి ఫలాలు|రాశిఫలాలు|దిన ఫలాలు|పంచాంగం|గ్రహాల సంచారం|జ్యోతిష్యం|జాతకం|'
    r'గోల్డ్ రేట్|గోల్డ్ రేట్స్|బంగారం ధర|బంగారం ధరలు|వెండి ధర|వెండి ధరలు|పసిడి ధర|'
    r'Gold Rate|Silver Rate|Todays Gold|Horoscope|Daily Horoscope|ePaper - |e-Paper)',
    re.IGNORECASE
)

AP_PATTERN = re.compile(
    r'/(andhra-pradesh|andhrapradesh|amaravati|vijayawada|visakhapatnam|guntur|tirupati|chittoor|kadapa|kurnool|anantapur|nellore|prakasam|srikakulam|vizianagaram)/|'
    r'(ఆంధ్రప్రదేశ్|ఆంధ్ర రాష్ట్ర|ఆంధ్రప్రదేశ్ లో|ఏపీలో|ఏపీ లో|వైసీపీ|వైఎస్సార్‌సీపీ|వైఎస్ జగన్|జగన్ మోహన్ రెడ్డి|చంద్రబాబు|'
    r'పవన్ కళ్యాణ్|నారా లోకేష్|జనసేన పార్టీ|జనసేన|అమరావతి రాజధాని|అమరావతి|విశాఖపట్నం|విశాఖ స్టీల్|విశాఖ|విజయవాడ|'
    r'తిరుపతి లడ్డూ|తిరుమల తిరుపతి|తిరుమల శ్రీవారి|శ్రీవారి హుండీ|తిరుపతి|తిరుమల|కాణిపాకం|శ్రీకాకుళం|విజయనగరం|కాకినాడ|రాజమండ్రి|'
    r'రాజమహేంద్రవరం|ఏలూరు|గుంటూరు|నెల్లూరు|ఒంగోలు|ప్రకాశం జిల్లా|బాపట్ల|పల్నాడు|నరసరావుపేట|'
    r'అనంతపురం|పుట్టపర్తి|కడప జిల్లా|వైఎస్సార్ కడప|రాయచోటి|తాడేపల్లి ప్యాలెస్|తాడేపల్లి|మంగళగిరి|అరకు లోయ|అరకు|అనకాపల్లి|'
    r'పిఠాపురం|భీమవరం|కర్నూలు జిల్లా|కోడుమూరు|డోన్|ఆదోని|ఎమ్మిగనూరు|నంద్యాల|సూళ్లూరుపేట|ఏపీ అసెంబ్లీ|ఏపీ హైకోర్టు|ఏపీ ప్రభుత్వం|ఏపీ కేబినెట్|'
    r'బొత్స|రోజా|కొడాలి నాని|అంబటి రాంబాబు|వల్లభనేని వంశీ|అచ్చెన్నాయుడు|వంగలపూడి అనిత|గోరంట్ల మాధవ్|బుద్దా వెంకన్న|'
    r'కేశినేని చిన్ని|కేశినేని నాని|పురందేశ్వరి|అవంతి శ్రీనివాస్|జగన్నాథరెడ్డి|పులివెందుల|కుప్పం|'
    r'హిందూపురం|మదనపల్లె|ప్రొద్దుటూరు|తాడిపత్రి|గుడివాడ|తెనాలి|సత్తెనపల్లి|వినుకొండ|గురజాల|మాచర్ల|'
    r'రాయలసీమ|కోస్తాంధ్ర|కోస్తా ఆంధ్ర|\bజగన్\b|'
    r'\bandhra pradesh\b|\bamaravati\b|\bvisakhapatnam\b|\bvijayawada\b|\btirupati\b|\bttd\b|'
    r'\bguntur\b|\bnellore\b|\bkurnool\b|\bkadapa\b|\banantapur\b|\bsrikakulam\b|\bvizianagaram\b|'
    r'\bkakinada\b|\brajahmundry\b|\beluru\b|\bongole\b|\bysrcp\b|\bchandrababu\b|\bjagan\b|\blokesh\b|'
    r'\bpawan kalyan\b|\bnandyal\b|\bhindupur\b|\bmangalagiri\b|\btadepalli\b|\bpalnadu\b|\bbapatla\b)',
    re.IGNORECASE
)

WORLD_PATTERN = re.compile(
    r'/(international|world)/|'
    r'(ఇజ్రాయెల్|గాజా|లెబనాన్|హిజ్బుల్లా|రష్యా|ఉక్రెయిన్|వ్లాదిమిర్ పుతిన్|జెలెన్‌స్కీ|'
    r'ఇరాన్|టెహ్రాన్|డొనాల్డ్ ట్రంప్|కమలా హారిస్|వైట్ హౌస్)',
    re.IGNORECASE
)

OTHER_STATES_PATTERN = re.compile(
    r'(kashmir|kulgam|srinagar|pahalgam|ladakh|\bleh\b|wangchuk|manipur|jammu|j&k|కాశ్మీర్|కశ్మీర్|లడఖ్|మణిపూర్|జమ్మూ|'
    r'delhi hc|delhi high court|bombay high court|madras high court|karnataka high court|'
    r'calcutta high court|allahabad high court|kerala high court|'
    r'ఢిల్లీ హైకోర్టు|బాంబే హైకోర్టు|మద్రాస్ హైకోర్టు|కర్ణాటక హైకోర్టు|కేరళ హైకోర్టు|'
    r'బెంగళూరు|చెన్నై|కోల్‌కతా|ముంబై|లక్నో|పాట్నా|తమిళనాడు|కర్ణాటక ప్రభుత్వం|మహారాష్ట్ర|'
    r'bcci|racing festival|formula 1|formula e|'
    r'\btamil nadu\b|\bkarnataka\b|\bmaharashtra\b|\bwest bengal\b|\bbengaluru\b|\bchennai\b|\bmumbai\b|\bkolkata\b)',
    re.IGNORECASE
)

def is_non_governance_content(title: str = "", summary: str = "", url: str = "") -> bool:
    """
    Returns True if the content is entertainment, movies, astrology, sports,
    Andhra Pradesh news, other non-TG states, or foreign affairs with zero Telangana context.
    Ensures ONLY genuine Telangana news enters the pipeline.
    """
    full_check = f"{title} {summary} {url}".strip()
    if not full_check:
        return True

    # 1. Junk tickers / Astrology (always reject)
    if JUNK_PATTERN.search(full_check):
        return True

    # 2. Sports (always reject)
    if SPORTS_PATTERN.search(full_check):
        return True

    # 3. Cinema & Entertainment (always reject)
    if CINEMA_PATTERN.search(full_check):
        return True

    # 4. Andhra Pradesh, Other States, and Foreign Affairs (Reject unless genuine TG context exists).
    # Only the URL *path* counts as context: a Telangana publisher's domain
    # (telanganatoday.com, namasthetelangaana.com) says nothing about the story itself.
    try:
        url_path = urlparse(url).path if url else ""
    except ValueError:
        url_path = ""
    tg_context_check = f"{title} {summary} {url_path}".strip()
    if not TG_PROTECTED_PATTERN.search(tg_context_check):
        if AP_PATTERN.search(full_check):
            return True
        if OTHER_STATES_PATTERN.search(full_check):
            return True
        if WORLD_PATTERN.search(full_check):
            return True

    return False

COMMON_STOP_WORDS = {
    "in", "at", "near", "the", "a", "an", "of", "and", "to", "for", "on", "out",
    "breaks", "break", "early", "morning", "reported", "telangana", "telanganas",
    "loss", "lakh", "rs", "two", "three", "four", "case", "registered",
    "incident"
}

def normalize_district_name(district: str) -> str:
    """Consolidate regional aliases so they are compared in the same bin."""
    if not district:
        return "Statewide"
    d = district.lower().replace("-", " ").replace("_", " ").strip()
    if "medchal" in d:
        return "Medchal-Malkajgiri"
    if "hyderabad" in d:
        return "Hyderabad"
    if "rangareddy" in d or "ranga reddy" in d:
        return "Rangareddy"
    return district.strip()

BILINGUAL_CIVIC_MAP = {
    # Incidents & emergencies
    "అగ్నిప్రమాదం": "fire", "అగ్ని": "fire", "మంటలు": "fire", "ప్రమాదం": "accident",
    "రోడ్డు ప్రమాదం": "accident", "వాహనం": "vehicle", "ముట్టడి": "gherao",
    "నిరసన": "protest", "ధర్నా": "protest", "సమ్మె": "strike", "దొంగతనం": "theft",
    "చోరీ": "theft", "హత్య": "murder", "మృతి": "dead", "మరణం": "dead",
    "గాయాలు": "injured", "వరద": "flood", "వర్షం": "rain",
    # Places & structures
    "చెక్ పోస్ట్": "checkpost", "చెక్పోస్ట్": "checkpost", "చెక్": "checkpost",
    "దుకాణం": "shop", "దుకాణాలు": "shops", "షాపు": "shop", "షాపులు": "shops",
    "మార్కెట్": "market", "హాస్పిటల్": "hospital", "ఆసుపత్రి": "hospital",
    "బడి": "school", "పాఠశాల": "school", "కళాశాల": "college",
    # Specific commodities & entities
    "ఫర్నిచర్": "furniture", "బంగారం": "gold", "వెండి": "silver", "ధాన్యం": "paddy",
    "రైతు": "farmer", "రైతులు": "farmers", "దగ్ధం": "gutted", "కాలిన": "burnt",
    # Administrative & Municipal Bodies
    "జీహెచ్‌ఎంసీ": "ghmc", "జీహెచ్ఎంసీ": "ghmc", "జిహెచ్ఎంసి": "ghmc",
    "హైడ్రా": "hydraa", "కమిషనర్": "commissioner", "కమిషనర్‌": "commissioner",
    "కలెక్టర్": "collector", "కలెక్టర్‌": "collector", "కార్పొరేషన్": "corporation",
    "మున్సిపల్": "municipal", "మున్సిపాలిటీ": "municipality",
    "సచివాలయం": "secretariat", "అసెంబ్లీ": "assembly", "శాసనసభ": "assembly",
    # Key Positions & Governance Terms
    "ముఖ్యమంత్రి": "cm", "సీఎం": "cm", "మంత్రి": "minister", "కేంద్ర మంత్రి": "union minister",
    "ప్రధాన మంత్రి": "pm", "పీఎం": "pm", "ఉప ముఖ్యమంత్రి": "deputy cm",
    "డిప్యూటీ సీఎం": "deputy cm", "గవర్నర్": "governor",
    "బాధ్యతలు స్వీకరించిన": "assumed charge", "బాధ్యతలు": "charge",
    "భేటీ": "meets", "సమావేశం": "meeting", "సమీక్ష": "review",
    "నిధులు": "funds", "మంజూరు": "sanctioned", "డీపీఆర్": "dpr", "మెట్రో": "metro",
    # Notable Officials & Key Names
    "ఆమ్రపాలి": "amrapali", "రంగనాథ్": "ranganath", "రేవంత్": "revanth",
    "రాజ్‌నాథ్": "rajnath", "కేటీఆర్": "ktr", "హరీష్ రావు": "harish rao",
    "బండి సంజయ్": "bandi sanjay", "కిషన్ రెడ్డి": "kishan reddy",
}


def extract_core_keywords(text: str) -> set:
    """Extracts significant keywords and cleans hashtags/source labels while preserving Telugu Unicode and mapping civic terms.
    The (slow) work is remembered per text; callers get their own copy so they can never change the cached one."""
    return set(_extract_core_keywords_cached(text))


@lru_cache(maxsize=50000)
def _extract_core_keywords_cached(text: str) -> frozenset:
    clean = re.sub(r"[\u200b-\u200f\uFEFF]", "", text)
    clean = re.sub(r"#\w+", "", clean)
    # Only strip publisher suffix if preceded by spaces and separator (e.g. " - The Hindu")
    clean = re.sub(r"\s+[-|–—]\s+[\w\s.]{2,30}$", "", clean)
    # Normalize common compound terms and incident synonyms
    clean = re.sub(r"\bcheck\s+post\b", "checkpost", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\bstores?\b", "shop", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\bblaze\b", "fire", clean, flags=re.IGNORECASE)
    
    has_te = any("\u0c00" <= ch <= "\u0c7f" for ch in clean)
    
    # Preserve alphanumeric, spaces, and Telugu Unicode block (\u0C00-\u0C7F)
    cleaned_lower = re.sub(r"[^\w\s\u0C00-\u0C7F]", " ", clean.lower())
    words = {w for w in cleaned_lower.split() if len(w) > 2 and w not in COMMON_STOP_WORDS}
    
    # Map Telugu keywords to English equivalents so Telugu articles match English articles instantly
    if has_te:
        for te_k, en_v in BILINGUAL_CIVIC_MAP.items():
            if te_k in clean:
                words.add(en_v.lower())
        for te_k, en_v in CONSTITUENCY_TELUGU.items():
            if te_k in clean:
                words.add(en_v.lower())
                
    return frozenset(words)

def get_english_text_representation(item: Dict[str, Any]) -> str:
    """
    Returns an English representation of the article.
    If the title is in native Telugu script, translates the title into English
    using the in-memory bilingual civic/constituency dictionary and cached translations.
    Runs in < 0.001ms without blocking network calls.
    """
    if not isinstance(item, dict):
        return ""
    if item.get("_english_text"):
        return item["_english_text"]
    if item.get("english_title"):
        item["_english_text"] = item["english_title"]
        return item["english_title"]
        
    title = item.get("title", "").strip()
    if not title:
        return ""
        
    is_te = any("\u0c00" <= ch <= "\u0c7f" for ch in title)
    if not is_te:
        item["_english_text"] = title
        return title
        
    # Fast in-memory civic & constituency translation (0 ms, zero latency)
    clean_t = re.sub(r"[\u200b-\u200f\uFEFF]", "", title)
    summary_snip = (item.get("summary") or item.get("description") or "")[:160]
    full_te = f"{clean_t} {summary_snip}"
    
    tokens = [en_v for te_k, en_v in BILINGUAL_CIVIC_MAP.items() if te_k in full_te]
    tokens += [en_v for te_k, en_v in CONSTITUENCY_TELUGU.items() if te_k in full_te]
    
    if tokens:
        synth = " ".join(dict.fromkeys(tokens))
        item["_english_text"] = synth
        return synth
        
    item["_english_text"] = title
    return title

def _similar(a: str, b: str, threshold: float) -> bool:
    """SequenceMatcher(a, b).ratio() >= threshold, but skips the expensive part when a cheap upper bound already says no."""
    sm = SequenceMatcher(None, a, b)
    return sm.real_quick_ratio() >= threshold and sm.quick_ratio() >= threshold and sm.ratio() >= threshold


def are_articles_same_event(item1: Dict[str, Any], item2: Dict[str, Any], similarity_threshold: float = 0.70) -> bool:
    """
    Robust multi-strategy comparison:
    1. SequenceMatcher (>= 0.70)
    2. Shared Core Keyword Overlap (e.g. 'furniture' + 'shops' + 'gutted' + 'medchal')
    3. Cross-script English token/hashtag matching (Telugu posts having English tags like #medchal #furnitureshop)
    4. Automated Cross-Lingual Translation Matching (bridges pure Telugu and English reporting)
    """
    t1 = item1.get("title", "").strip() if isinstance(item1, dict) else ""
    t2 = item2.get("title", "").strip() if isinstance(item2, dict) else ""
    if not t1 or not t2:
        return False

    norm1 = normalize_title_for_comparison(t1)
    norm2 = normalize_title_for_comparison(t2)
    if norm1 and norm2:
        if norm1 == norm2:
            return True
        if _similar(norm1, norm2, similarity_threshold):
            return True

    # Shared Core Keyword Overlap
    kw1 = extract_core_keywords(t1)
    kw2 = extract_core_keywords(t2)
    overlap = kw1 & kw2
    min_len = min(len(kw1), len(kw2)) if kw1 and kw2 else 0
    if len(overlap) >= 3:
        return True
    if min_len >= 2 and len(overlap) / min_len >= 0.70:
        return True

    # 3. Gemini AI Multilingual Semantic Similarity (Vector Embeddings)
    # Bridges English and Telugu articles reporting the exact same news event
    has_te1 = any("\u0c00" <= ch <= "\u0c7f" for ch in t1)
    has_te2 = any("\u0c00" <= ch <= "\u0c7f" for ch in t2)
    if has_te1 or has_te2 or (kw1 and kw2 and len(overlap) >= 1):
        try:
            from gemini_embedding_service import are_articles_semantically_identical
            sem_match = are_articles_semantically_identical(t1, t2)
            if sem_match is True:
                return True
        except Exception:
            pass

    # 4. Fallback: Cross-lingual Dictionary Translation Matching (English <-> Native Telugu)
    if has_te1 or has_te2:
        en1 = get_english_text_representation(item1)
        en2 = get_english_text_representation(item2)
        if en1 and en2:
            en_kw1 = extract_core_keywords(en1)
            en_kw2 = extract_core_keywords(en2)
            en_overlap = en_kw1 & en_kw2
            min_en_len = min(len(en_kw1), len(en_kw2)) if en_kw1 and en_kw2 else 0
            if len(en_overlap) >= 3:
                return True
            if min_en_len >= 2 and len(en_overlap) / min_en_len >= 0.70:
                return True
            norm_en1 = normalize_title_for_comparison(en1)
            norm_en2 = normalize_title_for_comparison(en2)
            if norm_en1 and norm_en2 and _similar(norm_en1, norm_en2, similarity_threshold):
                return True

    return False

def is_valid_telangana_content(title: str = "", summary: str = "", url: str = "") -> bool:
    """Returns True if the content is genuine Telangana governance / civic news."""
    return not is_non_governance_content(title, summary, url)

@lru_cache(maxsize=50000)
def normalize_title_for_comparison(title: str) -> str:
    """
    Cleans and normalizes title text for fuzzy matching.
    Lowercases, removes punctuation, publisher prefixes/suffixes, and excess spaces.
    """
    if not title:
        return ""
    # Only remove publisher suffix if preceded by spaces and separator (e.g., " - The Hindu", " | Eenadu")
    clean = re.sub(r"\s+[-|–—]\s+[A-Za-z0-9\s.]{2,30}$", "", title)
    clean = clean.lower()
    # Preserve Telugu Unicode characters as well as alphanumeric characters
    clean = re.sub(r"[^\w\s\u0C00-\u0C7F]", " ", clean)
    return re.sub(r"\s+", " ", clean).strip()

def fuzzy_title_similarity(t1_norm: str, t2_norm: str) -> float:
    """Calculates SequenceMatcher ratio between two normalized titles."""
    if not t1_norm or not t2_norm:
        return 0.0
    if t1_norm == t2_norm:
        return 1.0
    return SequenceMatcher(None, t1_norm, t2_norm).ratio()

def _cluster_single_bin(district: str, records: List[Dict[str, Any]], similarity_threshold: float = 0.70) -> List[Dict[str, Any]]:
    """Clusters articles within a single district partition."""
    clusters: List[Dict[str, Any]] = []
    
    for item in records:
        title = item.get("title", "").strip()
        if not title:
            continue
            
        summary = item.get("summary", "").strip()
        url = item.get("canonical_url", item.get("url", "")).strip()

        # Content Filter: Early skip of non-governance entertainment, gossip, astrology, sports
        if is_non_governance_content(title, summary, url):
            continue

        norm_title = normalize_title_for_comparison(title)
        raw_pub = item.get("publisher", "Unknown").strip()
        canon_pub = get_canonical_publisher(raw_pub, url)
        pub_at = item.get("published_at", datetime.now(timezone.utc).isoformat())
        
        matched_cluster = None
        highest_ratio = 0.0
        
        # Pre-compute token set for fast filtering
        norm_tokens = set(norm_title.split())
        
        for cluster in clusters:
            c_norm_title = cluster["_norm_title"]
            c_tokens = cluster["_tokens"]
            
            # Fast pre-check: length filter
            len_ratio = len(norm_title) / max(1, len(c_norm_title))
            if len_ratio < 0.50 or len_ratio > 2.0:
                continue
                
            # Fast word overlap check: skip SequenceMatcher if zero common words on non-trivial titles
            if norm_tokens and c_tokens:
                overlap = len(norm_tokens & c_tokens)
                if overlap == 0 and len(norm_title) > 10 and len(c_norm_title) > 10:
                    continue
                if len(norm_tokens) > 3 and len(c_tokens) > 3 and overlap < 2:
                    continue
                    
            ratio = fuzzy_title_similarity(norm_title, c_norm_title)
            
            # Check threshold
            if ratio >= similarity_threshold and ratio > highest_ratio:
                highest_ratio = ratio
                matched_cluster = cluster

        # Cross-lingual / Semantic event matching (bridges Telugu & English reports)
        if matched_cluster is None:
            is_te_curr = any("\u0c00" <= ch <= "\u0c7f" for ch in norm_title)
            for cluster in clusters:
                c_norm = cluster.get("_norm_title", "")
                is_te_c = any("\u0c00" <= ch <= "\u0c7f" for ch in c_norm)
                if is_te_curr != is_te_c:
                    if are_articles_same_event(item, cluster, similarity_threshold):
                        matched_cluster = cluster
                        break

        if matched_cluster is not None:
            # Same Event detected!
            existing_publishers = {get_canonical_publisher(s.get("publisher", ""), s.get("url", "")) for s in matched_cluster["sources"]}
            existing_urls = {canonicalize_url(s.get("url", "")) for s in matched_cluster["sources"]}
            
            c_url = canonicalize_url(url)
            if canon_pub in existing_publishers or (c_url and c_url in existing_urls):
                # Drop repeat/updated post; keep richer summary if longer
                if len(summary) > len(matched_cluster["summary"]):
                    matched_cluster["summary"] = summary
            else:
                # Same Event / Multi-Publisher
                matched_cluster["sources"].append({
                    "publisher": canon_pub,
                    "url": url
                })
                if len(summary) > len(matched_cluster["summary"]):
                    matched_cluster["summary"] = summary
        else:
            # New Event cluster - Use separate local variables to prevent mutating outer bin 'district'
            c_res = item.get("constituency")
            civic_consts = item.get("civic_constituencies") or []
            if isinstance(c_res, tuple) and len(c_res) >= 5:
                c_constituency, c_district, all_consts, _, civic_consts = c_res[:5]
            elif isinstance(c_res, tuple) and len(c_res) >= 3:
                c_constituency, c_district, all_consts = c_res[0], c_res[1], c_res[2]
            elif isinstance(c_res, tuple):
                c_constituency, c_district = c_res
                all_consts = [c_constituency] if c_constituency != 'Statewide' else []
            elif c_res:
                c_constituency = c_res
                c_district = item.get("district") or district or "Statewide"
                all_consts = item.get("constituencies") or ([c_constituency] if c_constituency != 'Statewide' else [])
            else:
                item_hint_dist = item.get("district") or district or "Statewide"
                c_data = classify_article_constituency(
                    title, summary, "", item_hint_dist, return_all=True
                )
                c_constituency, c_district, all_consts = c_data[0], c_data[1], c_data[2]
                civic_consts = c_data[4] if len(c_data) > 4 else []

            new_cluster = {
                "title": title,
                "district": c_district,
                "constituency": c_constituency,
                "constituencies": all_consts,
                "civic_constituencies": civic_consts,
                "state": item.get("state", "Telangana"),
                "summary": summary,
                "sources": [
                    {
                        "publisher": canon_pub,
                        "url": url
                    }
                ],
                "published_at": pub_at,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "_norm_title": norm_title,
                "_tokens": norm_tokens
            }
            clusters.append(new_cluster)
            
    # Clean up temporary helper tokens and ensure unique sources
    for c in clusters:
        c.pop("_norm_title", None)
        c.pop("_tokens", None)
        c["sources"] = deduplicate_sources(c.get("sources", []))

    # Natural Multi-Source AI Summarization (Synthesizes facts based on news depth)
    try:
        from gemini_summary_service import generate_natural_summary
        for c in clusters:
            curr_s = c.get("summary", "")
            # Only synthesize if not already cleanly summarized
            if curr_s:
                c["summary"] = generate_natural_summary(
                    c.get("title", ""),
                    curr_s,
                    c.get("sources", [])
                )
    except Exception as e:
        logger.debug(f"AI summarization notice: {e}")
        
    return clusters


def _location_score(c: Dict[str, Any]) -> int:
    """Higher = more specific / more plausible location for a story."""
    score = 0
    dist = c.get("district") or "Statewide"
    const = c.get("constituency") or "Statewide"
    if dist != "Statewide":
        score += 1
    if const != "Statewide":
        score += 1
        try:
            if const in get_constituencies_for_district(dist):
                score += 2  # constituency really belongs to this district
        except Exception:
            pass
    return score


def merge_cross_bin_duplicates(clusters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    District bins are clustered independently, so one story reported under 'Hyderabad' by one
    collector and 'Statewide' by another becomes two rows. Merge clusters whose normalized titles
    are identical AND that either share a real constituency or where one is 'Statewide'.
    Distinct events with a generic title in two different districts are left alone.
    """
    by_title: Dict[str, List[Dict[str, Any]]] = {}
    for c in clusters:
        key = normalize_title_for_comparison(c.get("title", ""))
        by_title.setdefault(key if key else f"__id_{id(c)}", []).append(c)

    merged: List[Dict[str, Any]] = []
    for group in by_title.values():
        if len(group) == 1:
            merged.extend(group)
            continue
        group = sorted(group, key=_location_score, reverse=True)
        kept: List[Dict[str, Any]] = []
        for c in group:
            target = None
            for k in kept:
                same_const = (c.get("constituency") or "Statewide") != "Statewide" and c.get("constituency") == k.get("constituency")
                either_statewide = (c.get("district") or "Statewide") == "Statewide" or (k.get("district") or "Statewide") == "Statewide"
                if same_const or either_statewide:
                    target = k
                    break
            if target is None:
                kept.append(c)
                continue
            target["sources"] = deduplicate_sources(list(target.get("sources", [])) + list(c.get("sources", [])))
            for fld in ("constituencies", "civic_constituencies"):
                target[fld] = sorted(set(target.get(fld) or []) | set(c.get(fld) or []))
            if not target.get("summary") and c.get("summary"):
                target["summary"] = c["summary"]
        merged.extend(kept)
    return merged


def deduplicate_and_cluster(
    raw_records: List[Dict[str, Any]],
    similarity_threshold: float = 0.70
) -> List[Dict[str, Any]]:
    """
    Executes the 3-stage clustering & deduplication engine:
    - Stage 1: URL Filter (drop identical URLs across all collectors)
    - Stage 2: District Binning (partition into 33 districts + Statewide)
    - Stage 3: Concurrent Fuzzy Clustering per partition via ThreadPoolExecutor
    Returns: List of clustered event dicts ready for PostgreSQL single-table storage.
    """
    # STAGE 1: URL Filter
    seen_urls = set()
    url_filtered_records = []
    
    for r in raw_records:
        raw_url = r.get("url", "")
        canon_url = canonicalize_url(raw_url)
        if not canon_url or canon_url in seen_urls:
            continue
        seen_urls.add(canon_url)
        r_copy = dict(r)
        r_copy["canonical_url"] = canon_url
        url_filtered_records.append(r_copy)
        
    # STAGE 2: District Binning
    district_bins: Dict[str, List[Dict[str, Any]]] = {}
    for r in url_filtered_records:
        dist = r.get("district", "Statewide") or "Statewide"
        district_bins.setdefault(dist, []).append(r)
        
    # STAGE 3: Concurrent Fuzzy Clustering across district bins
    clustered_records: List[Dict[str, Any]] = []
    
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [
            executor.submit(_cluster_single_bin, district, records, similarity_threshold)
            for district, records in district_bins.items()
        ]
        for f in as_completed(futures):
            clustered_records.extend(f.result())

    return merge_cross_bin_duplicates(clustered_records)


if __name__ == "__main__":
    # Self-test with sample mock records
    mock_records = [
        # Same event, different publishers -> Should cluster into 1 record with 2 sources
        {
            "title": "Foundation stone for Warangal Mamnoor airport likely in December",
            "district": "Warangal",
            "publisher": "The Hindu",
            "url": "https://thehindu.com/news/cities/Hyderabad/airport-december",
            "summary": "Airport foundation stone in December"
        },
        {
            "title": "Foundation stone for Warangal's Mamnoor airport likely in December",
            "district": "Warangal",
            "publisher": "Sakshi",
            "url": "https://sakshi.com/telangana/warangal/airport-dec",
            "summary": "Mamnoor airport in Warangal to get foundation in December."
        },
        # Same event, same publisher -> Should drop duplicate
        {
            "title": "Foundation stone for Warangal Mamnoor airport likely in December",
            "district": "Warangal",
            "publisher": "The Hindu",
            "url": "https://thehindu.com/news/cities/Hyderabad/airport-december-updated",
            "summary": "Updated: Airport foundation stone in December"
        },
        # Different event -> Should form its own cluster
        {
            "title": "Heavy rains lash Karimnagar district, reservoirs full",
            "district": "Karimnagar",
            "publisher": "Eenadu",
            "url": "https://eenadu.net/telangana/karimnagar/rains",
            "summary": "Rainfall in Karimnagar"
        }
    ]
    
    clustered = deduplicate_and_cluster(mock_records)
    print(f"Mock input: {len(mock_records)} records")
    print(f"Clustered output: {len(clustered)} records")
    for i, c in enumerate(clustered, 1):
        print(f"\nCluster {i}:")
        print(f"  Title: {c['title']}")
        print(f"  District: {c['district']}")
        print(f"  Sources count: {len(c['sources'])}")
        print(f"  Sources: {c['sources']}")
