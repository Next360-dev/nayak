"""
services/translation_service.py
Telugu <-> English translation via MyMemory API with two-tier caching:
1. Fast in-memory dictionary cache (sub-millisecond)
2. Permanent PostgreSQL database cache via queries/translation.sql
"""

import html
import hashlib
import logging
import requests
from app.core.database import get_connection
from app.queries import get_query

logger = logging.getLogger("translation_service")

_SQL_CREATE_TABLE = get_query("translation.sql", "create_table_translation_cache")
_SQL_FETCH_CACHED = get_query("translation.sql", "fetch_cached_translation")
_SQL_UPSERT_CACHED = get_query("translation.sql", "upsert_cached_translation")

_mem_cache: dict[str, str] = {}
_table_initialized = False


def _ensure_cache_table():
    global _table_initialized
    if _table_initialized:
        return
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(_SQL_CREATE_TABLE)
            conn.commit()
        _table_initialized = True
    except Exception as e:
        logger.warning(f"Could not initialize translations_cache table: {e}")


def _get_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _get_db_cached(source_lang: str, target_lang: str, text: str) -> str | None:
    _ensure_cache_table()
    try:
        t_hash = _get_hash(text)
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(_SQL_FETCH_CACHED, (source_lang, target_lang, t_hash))
                row = cur.fetchone()
                if row and row[0]:
                    return row[0]
    except Exception as e:
        logger.debug(f"DB cache read error: {e}")
    return None


def _set_db_cached(source_lang: str, target_lang: str, text: str, translated: str):
    _ensure_cache_table()
    try:
        t_hash = _get_hash(text)
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(_SQL_UPSERT_CACHED, (source_lang, target_lang, t_hash, text, translated))
            conn.commit()
    except Exception as e:
        logger.debug(f"DB cache write error: {e}")


def translate_text(text: str, target_lang: str | None = None) -> dict:
    if not text or not str(text).strip():
        return {"translated_text": text, "source_lang": "en", "target_lang": "te"}

    text = str(text).strip()
    is_telugu = any("\u0c00" <= ch <= "\u0c7f" for ch in text)
    source_lang = "te" if is_telugu else "en"
    if not target_lang:
        target_lang = "en" if is_telugu else "te"
    elif target_lang == source_lang:
        return {"translated_text": text, "source_lang": source_lang, "target_lang": target_lang}

    mem_key = f"{source_lang}|{target_lang}|{text}"
    # 1. Tier 1: In-memory cache
    if mem_key in _mem_cache:
        return {"translated_text": _mem_cache[mem_key], "source_lang": source_lang, "target_lang": target_lang}

    # 2. Tier 2: Persistent PostgreSQL database cache
    db_val = _get_db_cached(source_lang, target_lang, text)
    if db_val:
        _mem_cache[mem_key] = db_val
        return {"translated_text": db_val, "source_lang": source_lang, "target_lang": target_lang}

    # Split into <= 400-char chunks for external API
    chunks = []
    current_chunk = ""
    for sentence in text.replace("\n", " ").split(". "):
        if len(current_chunk) + len(sentence) < 400:
            current_chunk += sentence + ". "
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence + ". "
    if current_chunk:
        chunks.append(current_chunk.strip())

    translated_chunks = []
    for chunk in chunks:
        ck = f"{source_lang}|{target_lang}|{chunk}"
        if ck in _mem_cache:
            translated_chunks.append(_mem_cache[ck])
            continue
        
        # Check DB for individual chunk
        db_chunk = _get_db_cached(source_lang, target_lang, chunk)
        if db_chunk:
            _mem_cache[ck] = db_chunk
            translated_chunks.append(db_chunk)
            continue

        try:
            resp = requests.get(
                "https://api.mymemory.translated.net/get",
                params={"q": chunk, "langpair": f"{source_lang}|{target_lang}"},
                timeout=6,
            )
            if resp.ok:
                t_chunk = resp.json().get("responseData", {}).get("translatedText")
                if t_chunk:
                    t_chunk = html.unescape(t_chunk)
                    _mem_cache[ck] = t_chunk
                    _set_db_cached(source_lang, target_lang, chunk, t_chunk)
                    translated_chunks.append(t_chunk)
                    continue
        except Exception:
            pass
        translated_chunks.append(chunk)

    final = " ".join(translated_chunks).strip()
    _mem_cache[mem_key] = final
    _set_db_cached(source_lang, target_lang, text, final)
    return {"translated_text": final, "source_lang": source_lang, "target_lang": target_lang}
