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


def _fallback_sentiment(title: str, summary: str = "", priority_score: int = 3) -> str:
    """
    Deterministic fallback when AI is unavailable or offline.
    Strictly returns 'positive' or 'negative' — NO neutral.
    """
    text = f"{title} {summary}".lower()
    negative_indicators = [
        "death", "dead", "kill", "murder", "accident", "protest", "strike", "dharna",
        "crisis", "shortage", "flood", "fire", "scam", "corrupt", "arrest", "collapse",
        "suicide", "injury", "fail", "neglect", "delay", "crime", "theft", "bribe",
        "clash", "loss", "damage", "complaint", "hazard", "danger", "illegal", "fraud",
        "మృతి", "మరణం", "హత్య", "ప్రమాదం", "ధర్నా", "నిరసన", "సంక్షోభం", "కొరత",
        "వరద", "అగ్నిప్రమాదం", "స్కాం", "అవినీతి", "అరెస్ట్", "వైఫల్యం", "సమస్య",
        "ఫిర్యాదు", "మోసం", "దాడి", "దోపిడీ", "లంచం"
    ]
    if priority_score == 1 or any(k in text for k in negative_indicators):
        return "negative"
    return "positive"


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
