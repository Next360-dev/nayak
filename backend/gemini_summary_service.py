"""
gemini_summary_service.py
Natural AI News Summarizer powered by Google Gemini (gemini-3.5-flash-lite / gemini-3.8-flash).

Key Features:
- Multi-source synthesis: Reads reporting across 1 or more newspaper sources.
- Natural line scaling: Adapts naturally to the depth of the story (does NOT forcefully stretch or cut).
- Smart sentence-boundary fallback: If offline or quota is exceeded, extracts 2-3 complete sentences.
- High-performance: Fast, non-blocking execution with in-memory caching.
"""

import os
import re
import logging
import time
from typing import List, Dict, Any, Optional

logger = logging.getLogger("gemini_summary_service")

_FALLBACK_GENERATION_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-3.5-flash"
]

_SUMMARY_CACHE: Dict[str, str] = {}
_RATE_LIMITED_UNTIL: float = 0.0


def _get_gemini_client():
    """Lazily retrieves Gemini client from gemini_embedding_service."""
    try:
        from gemini_embedding_service import get_gemini_client
        return get_gemini_client()
    except Exception as e:
        logger.debug(f"Could not load Gemini client: {e}")
        return None


def smart_natural_fallback(title: str, full_text: str) -> str:
    """
    Extracts a natural summary based on complete sentence boundaries (. or ।),
    adapting to the natural lines and content of the news without forceful truncation.
    """
    clean_text = (full_text or "").strip()
    if not clean_text or clean_text == title.strip():
        return title.strip()

    # Split into clean sentences by punctuation
    raw_sentences = re.split(r"(?<=[.!?।])\s+", clean_text)
    sentences = [s.strip() for s in raw_sentences if len(s.strip()) > 15]

    if not sentences:
        # Fallback to clean word boundary
        words = clean_text.split()
        return " ".join(words[:60]) + ("." if not clean_text.endswith((".", "।")) else "")

    # Follow the natural flow of the news lines based on depth
    selected = []
    current_len = 0
    for s in sentences:
        selected.append(s)
        current_len += len(s)
        # Stop naturally when complete context is conveyed (up to 4 sentences or ~400 chars)
        if current_len >= 320 or len(selected) >= 4:
            break

    return " ".join(selected)


def generate_natural_summary(
    title: str,
    body_text: str,
    sources: Optional[List[Dict[str, Any]]] = None
) -> str:
    """
    Synthesizes a clean, natural summary across one or multiple newspaper sources.
    Adapts naturally to the depth and facts of the story without forcing an artificial line count.
    """
    t_clean = (title or "").strip()
    b_clean = (body_text or "").strip()
    if not t_clean and not b_clean:
        return ""

    # Check in-memory cache
    cache_key = f"{t_clean[:60]}::{b_clean[:60]}"
    if cache_key in _SUMMARY_CACHE:
        return _SUMMARY_CACHE[cache_key]

    # Detect language
    combined_sample = f"{t_clean} {b_clean}"
    is_telugu = any("\u0c00" <= ch <= "\u0c7f" for ch in combined_sample)
    target_lang = "Telugu" if is_telugu else "English"

    # Assemble multi-source reporting text
    source_texts = []
    if sources:
        for s in sources:
            if isinstance(s, dict):
                pub = s.get("publisher", "Source")
                txt = s.get("snippet") or s.get("summary") or ""
                if txt and txt not in source_texts:
                    source_texts.append(f"[{pub}]: {txt}")

    if not source_texts:
        source_texts.append(b_clean or t_clean)

    reporting_block = "\n".join(source_texts[:4])  # Up to 4 sources combined

    # Check rate limit cooldown
    global _RATE_LIMITED_UNTIL
    if time.time() < _RATE_LIMITED_UNTIL:
        fallback = smart_natural_fallback(t_clean, b_clean)
        _SUMMARY_CACHE[cache_key] = fallback
        return fallback

    client = _get_gemini_client()
    if not client:
        fallback = smart_natural_fallback(t_clean, b_clean)
        _SUMMARY_CACHE[cache_key] = fallback
        return fallback

    prompt = (
        f"You are an executive Telangana governance news editor.\n"
        f"Read this reporting from one or multiple newspapers:\n"
        f"Headline: {t_clean}\n"
        f"Reporting Content:\n{reporting_block}\n\n"
        f"Write a natural, crisp, factual news summary adapted strictly to the depth and lines of the story. "
        f"Do NOT forcefully constrain or compress the news into arbitrary 2-3 lines: "
        f"if it is a concise update, keep it naturally brief; if it is a multi-faceted event with multiple facts, "
        f"let it naturally convey all necessary context. "
        f"Preserve key figures, amounts, names, locations, and government actions. "
        f"Do not include bullet points, asterisks, bold tags, or conversational introductory phrases. "
        f"Output ONLY the clean summary text in {target_lang}."
    )

    for model_name in _FALLBACK_GENERATION_MODELS:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            if response and response.text:
                summary_text = response.text.strip()
                # Clean up any quotes or prefix artifacts
                summary_text = re.sub(r'^(Summary:|సారాంశం:)\s*', '', summary_text, flags=re.IGNORECASE)
                if len(summary_text) >= 30:
                    _SUMMARY_CACHE[cache_key] = summary_text
                    return summary_text
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "Too Many Requests" in err_str:
                _RATE_LIMITED_UNTIL = time.time() + 20
                logger.debug("Gemini rate limit (429) hit. Activating 20s cooldown and natural fallback.")
                break
            logger.debug(f"Gemini summary generation with {model_name} failed: {e}")
            continue

    # Graceful fallback if Gemini generation is unavailable or rate limited
    fallback = smart_natural_fallback(t_clean, b_clean)
    _SUMMARY_CACHE[cache_key] = fallback
    return fallback
