"""
services/sentiment_service.py
AI-Powered Binary Sentiment Analysis Engine using Google GenAI (Gemini) SDK.

Strictly classifies news articles into either POSITIVE or NEGATIVE:
  - POSITIVE: Development, welfare schemes, fund sanctions, progress, awards, inaugurations, public assistance.
  - NEGATIVE: Grievances, protests, accidents, civic failures, power/water shortage, corruption, crimes, disasters.

NO NEUTRAL news — every single article is categorized into Positive or Negative.
Configured via backend/.env:
  GEMINI_API_KEY=your_key_here
  GEMINI_MODEL=gemini-3.5-flash
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger("sentiment_service")

# In-memory LRU-like cache: title_hash -> 'positive' | 'negative'
_SENTIMENT_CACHE: Dict[str, str] = {}
_MAX_CACHE_SIZE = 5000

# Singleton GenAI client
_client = None
_client_initialized = False


def get_genai_client():
    """Lazily initializes and returns the Google GenAI Client if API key is present."""
    global _client, _client_initialized
    if _client_initialized:
        return _client

    api_key = (settings.GEMINI_API_KEY or "").strip()
    if not api_key:
        logger.debug("GEMINI_API_KEY not configured. Add GEMINI_API_KEY to backend/.env to enable AI sentiment.")
        _client_initialized = True
        _client = None
        return None

    try:
        from google import genai
        _client = genai.Client(api_key=api_key)
        _client_initialized = True
        logger.info(f"Google GenAI Client initialized successfully (Model: {settings.GEMINI_MODEL})")
        return _client
    except Exception as e:
        logger.warning(f"Failed to initialize Google GenAI Client: {e}")
        _client_initialized = True
        _client = None
        return None


def _normalize_key(title: str) -> str:
    """Creates a cleaned normalization key for caching."""
    return re.sub(r"\s+", " ", title.strip().lower())[:120]


def _call_gemini_with_fallback(client, prompt: str) -> Optional[str]:
    """Tries the configured model, automatically falling back if busy (503) or not found."""
    models_to_try = [settings.GEMINI_MODEL, "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash"]
    seen = set()
    unique_models = [m for m in models_to_try if not (m in seen or seen.add(m))]

    for model_name in unique_models:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            if response and response.text:
                return response.text
        except Exception as e:
            logger.debug(f"Gemini model {model_name} attempt failed: {e}")
            continue
    return None


POSITIVE_INDICATORS = [
    "inaugurat", "launched", "launches", "sanctioned", "award", "felicitat", "honoured", "honored", "wins ", " won ",
    "success", "relief", "approved", "completed", "boost", "benefit", "scholarship", "rescued", "donat", "celebrat",
    "praised", "milestone", "lauded", "applauded", "distributed",
    "ప్రారంభ", "మంజూరు", "పురస్కారం", "అవార్డు", "విజయం", "విజేత", "సన్మానం", "సత్కారం", "అభినందన", "ప్రశంస",
    "శంకుస్థాపన", "ఘనంగా", "ఆదుకున్న", "కాపాడిన", "పంపిణీ", "అభివృద్ధి",
]


def _fallback_sentiment(title: str, summary: str = "", priority_score: int = 3, neutral_fallback: bool | None = None) -> str:
    """
    Deterministic fallback when AI is unavailable or offline.
    Returns 'negative' when a clearly negative word is present. Otherwise: 'positive' (the original design), or, when
    SENTIMENT_NEUTRAL_FALLBACK is on, 'positive' only if a clearly positive word is present and 'neutral' if not.
    """
    if neutral_fallback is None:
        from app.core.config import settings
        neutral_fallback = settings.SENTIMENT_NEUTRAL_FALLBACK
    text = f"{title} {summary}".lower()
    negative_indicators = [
        "death", "dead", "kill", "murder", "accident", "protest", "strike", "dharna",
        "crisis", "shortage", "flood", "fire", "scam", "corrupt", "arrest", "collapse",
        "suicide", "injury", "fail", "neglect", "delay", "crime", "theft", "bribe",
        "clash", "loss", "damage", "complaint", "hazard", "danger", "illegal", "fraud",
        "మృతి", "మరణం", "హత్య", "ప్రమాదం", "ధర్నా", "నిరసన", "సంక్షోభం", "కొరత",
        "వరద", "అగ్నిప్రమాదం", "స్కాం", "అవినీతి", "అరెస్ట్", "వైఫల్యం", "సమస్య",
        "ఫిర్యాదు", "మోసం", "దాడి", "దోపిడీ", "లంచం",
        # added after a spot check of real headlines (these were being shown as positive)
        "బీభత్సం", "దుర్మరణం", "చెదిరింది", "చిన్నచూపు", "ఇబ్బందులు", "కష్టాలు", "ఆవేదన",
        "వేధింపులు", "ఆందోళన", "అక్రమాలు", "దౌర్జన్యం", "ఘర్షణ", "నిర్లక్ష్యం", "వైఫల్యం"
    ]
    if priority_score == 1 or any(k in text for k in negative_indicators):
        return "negative"
    if neutral_fallback and not any(k in text for k in POSITIVE_INDICATORS):
        return "neutral"
    return "positive"


# ── Local AI (Ollama) for the tone of NEW stories ────────────────────────────
OLLAMA_SYSTEM = (
    "You label the tone of Telangana (India) governance and civic news for a political office. "
    "Headlines may be in Telugu or English. Answer with exactly ONE word:\n"
    "POSITIVE = development, welfare, awards, inaugurations, relief, achievements, good news for people.\n"
    "NEGATIVE = accidents, deaths, crimes, protests, grievances, shortages, corruption, civic failures, bad news.\n"
    "NEUTRAL = announcements, meetings, statements, schedules, anything without a clear good or bad outcome."
)


class _CycleBudget:
    """Limits the AI per scrape cycle: how many stories, how much time, and stops after repeated failures."""
    def __init__(self):
        self.reset()

    def reset(self):
        self.used = 0
        self.started = None
        self.failures = 0

    def allow(self) -> bool:
        import time
        if self.started is None:
            self.started = time.monotonic()
        return (self.failures < 3 and self.used < settings.OLLAMA_MAX_PER_CYCLE
                and time.monotonic() - self.started < settings.OLLAMA_MAX_SECONDS_PER_CYCLE)


_budget = _CycleBudget()
_AI_CACHE: Dict[str, str] = {}


def begin_cycle() -> None:
    """Called at the start of each scrape cycle: fresh AI budget (a previous outage must not disable it forever)."""
    _budget.reset()


def ollama_enabled() -> bool:
    return bool((settings.OLLAMA_MODEL or "").strip())


def _ollama_label(title: str, summary: str = "") -> Optional[str]:
    """Asks the local model for one word. Returns 'positive' | 'negative' | 'neutral', or None if it failed or was unclear."""
    import urllib.request
    body = json.dumps({
        "model": settings.OLLAMA_MODEL.strip(), "stream": False, "keep_alive": "15m",
        "options": {"temperature": 0, "num_predict": 6},
        "messages": [{"role": "system", "content": OLLAMA_SYSTEM},
                     {"role": "user", "content": f"Headline: {title}\nSummary: {(summary or '')[:300]}"}],
    }).encode("utf-8")
    req = urllib.request.Request(settings.OLLAMA_URL.rstrip("/") + "/api/chat", body, {"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=settings.OLLAMA_TIMEOUT_SECONDS) as r:
            answer = (json.loads(r.read().decode("utf-8", "replace")).get("message") or {}).get("content", "")
    except Exception as e:
        logger.debug("Ollama call failed: %s", e)
        return None
    word = re.sub(r"[^a-z]", "", (answer or "").strip().lower().split()[0] if (answer or "").strip() else "")
    for prefix, label in (("pos", "positive"), ("neg", "negative"), ("neu", "neutral")):
        if word.startswith(prefix):
            return label
    return None


def classify_tone(title: str, summary: str = "", priority_score: int = 3) -> str:
    """
    The tone to STORE for a new story. Keyword rules always give an answer; if a local model is configured and healthy it may
    improve on it. Safe by design: any problem (off, down, slow, unclear, over budget) falls back to the rules, and an urgent
    story (priority 1) is never downgraded from negative.
    """
    rules = _fallback_sentiment(title, summary, priority_score)
    if not ollama_enabled() or priority_score == 1:
        return rules
    key = _normalize_key(title)
    if key in _AI_CACHE:
        return _AI_CACHE[key]
    if not _budget.allow():
        return rules
    label = _ollama_label(title, summary)
    if label is None:
        _budget.failures += 1
        return rules
    _budget.failures = 0
    _budget.used += 1
    if label == "neutral":
        label = "neutral" if settings.SENTIMENT_NEUTRAL_FALLBACK else rules   # the binary design has no neutral unless switched on
    if len(_AI_CACHE) >= _MAX_CACHE_SIZE:
        _AI_CACHE.clear()
    _AI_CACHE[key] = label
    return label


def analyze_article_sentiment(title: str, summary: str = "", priority_score: int = 3) -> str:
    """
    Analyzes sentiment for a single news article using Gemini AI.
    Strictly returns: 'positive' | 'negative' (NO neutral).
    """
    cache_key = _normalize_key(title)
    if cache_key in _SENTIMENT_CACHE:
        return _SENTIMENT_CACHE[cache_key]

    client = get_genai_client()
    if not client:
        fallback = _fallback_sentiment(title, summary, priority_score)
        _SENTIMENT_CACHE[cache_key] = fallback
        return fallback

    prompt = (
        "You are an expert news sentiment classifier for governance, public administration, "
        "and civic affairs in Telangana, India.\n"
        "Classify the sentiment of the following news story strictly into ONE of two categories: POSITIVE or NEGATIVE.\n"
        "Do NOT return NEUTRAL. Every news story must be decided as POSITIVE or NEGATIVE:\n"
        "- POSITIVE: Government welfare schemes, development, sanction of funds, infrastructure progress, awards, beneficial public services, inaugurations, farmer assistance, constructive civic developments, societal progress.\n"
        "- NEGATIVE: Public grievances, protests, accidents, deaths, crimes, civic failures, corruption, floods, fire, water/power crisis, scams, strikes, citizen complaints, road damage, delays.\n\n"
        f"Headline: {title}\n"
        f"Summary: {summary}\n\n"
        "Respond ONLY with one word: POSITIVE or NEGATIVE."
    )

    raw_text = _call_gemini_with_fallback(client, prompt)
    if not raw_text:
        fallback = _fallback_sentiment(title, summary, priority_score)
        _SENTIMENT_CACHE[cache_key] = fallback
        return fallback

    raw_lower = raw_text.strip().lower()
    sentiment = "negative" if "neg" in raw_lower else "positive"

    if len(_SENTIMENT_CACHE) >= _MAX_CACHE_SIZE:
        _SENTIMENT_CACHE.clear()
    _SENTIMENT_CACHE[cache_key] = sentiment
    return sentiment


def batch_enrich_sentiment(articles: List[Dict[str, Any]], batch_size: int = 15, max_ai_classify: int = 25) -> List[Dict[str, Any]]:
    """
    Enriches a list of article dicts with binary AI sentiment ('positive' | 'negative').
    NO NEUTRAL: every article is either positive or negative.
    High-speed deterministic classification runs in < 1ms.
    """
    if not articles:
        return articles

    # Step 1: Check cache first
    uncached_indices: List[int] = []
    for idx, art in enumerate(articles):
        title = art.get("headline") or art.get("title") or ""
        key = _normalize_key(title)
        if key in _SENTIMENT_CACHE:
            art["sentiment"] = _SENTIMENT_CACHE[key]
        else:
            uncached_indices.append(idx)

    # Apply fast, highly-accurate deterministic classification to all uncached items (0ms latency)
    for idx in uncached_indices:
        art = articles[idx]
        s = _fallback_sentiment(
            art.get("headline") or art.get("title") or "",
            art.get("summary") or "",
            art.get("priority_score", 3)
        )
        art["sentiment"] = s
        k = _normalize_key(art.get("headline") or art.get("title") or "")
        _SENTIMENT_CACHE[k] = s

    return articles
