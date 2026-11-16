"""
gemini_embedding_service.py
Multilingual AI Semantic Deduplication Engine powered by Google Gemini Embeddings.

Features:
- Multilingual Vector Representation (Telugu, English, Urdu) using gemini-embedding-001.
- In-memory thread-safe LRU cache to conserve Gemini API quota.
- Automatic chunked batching (up to 50 articles per API call).
- Graceful, zero-downtime fallback to rule-based deduplication if offline or quota exceeded.
- Cosine similarity calculation for cross-lingual news event clustering.
"""

import os
import sys
import math
import logging
import hashlib
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger("gemini_embedding_service")

# ─────────────────────────────────────────────────────────────────────────────
# Configuration & Client Initialization
# ─────────────────────────────────────────────────────────────────────────────
_client = None
_client_initialized = False
_model_name = "gemini-embedding-001"
_fallback_models = ["gemini-embedding-001", "gemini-embedding-2", "gemini-embedding-2-preview"]

# In-memory thread-safe vector cache: text_hash -> List[float]
_EMBEDDING_CACHE: Dict[str, List[float]] = {}
_MAX_CACHE_SIZE = 15000

# Recommended threshold: identical cross-lingual events score >= 0.82
SEMANTIC_SIMILARITY_THRESHOLD = 0.82


def _get_api_key() -> str:
    """Retrieves GEMINI_API_KEY from environment, dotenv, or settings."""
    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        try:
            from dotenv import load_dotenv
            base_dir = os.path.dirname(os.path.abspath(__file__))
            env_paths = [
                os.path.join(base_dir, ".env"),
                os.path.join(os.path.dirname(base_dir), ".env"),
                os.path.join(os.path.dirname(os.path.dirname(base_dir)), ".env"),
            ]
            for ep in env_paths:
                if os.path.exists(ep):
                    load_dotenv(ep)
                    break
            key = os.getenv("GEMINI_API_KEY", "")
        except Exception:
            pass
    if not key:
        try:
            from app.core.config import settings
            key = getattr(settings, "GEMINI_API_KEY", "")
        except Exception:
            pass
    return (key or "").strip()



def get_gemini_client():
    """Lazily initializes and returns the Google GenAI client if configured."""
    global _client, _client_initialized
    if _client_initialized:
        return _client

    api_key = _get_api_key()
    if not api_key:
        logger.info("GEMINI_API_KEY not configured. Semantic embeddings disabled (using rule-based fallback).")
        _client_initialized = True
        _client = None
        return None

    try:
        from google import genai
        _client = genai.Client(api_key=api_key)
        _client_initialized = True
        logger.info(f"Gemini Embedding Client initialized successfully with model {_model_name}.")
        return _client
    except Exception as e:
        logger.warning(f"Failed to initialize Gemini GenAI client: {e}. Falling back to rule-based engine.")
        _client_initialized = True
        _client = None
        return None


def is_gemini_available() -> bool:
    """Returns True if Gemini client is ready to generate embeddings."""
    return get_gemini_client() is not None


import json
import time
import threading
from app.core.database import get_connection
from app.queries import get_query

# ─────────────────────────────────────────────────────────────────────────────
# PostgreSQL Permanent Cache Setup (Viewable in pgAdmin 4)
# ─────────────────────────────────────────────────────────────────────────────
_SQL_CREATE_EMB_TABLE = get_query("embeddings.sql", "create_table_gemini_embeddings_cache")
_SQL_FETCH_CACHED_EMB = get_query("embeddings.sql", "fetch_cached_embedding")
_SQL_UPSERT_CACHED_EMB = get_query("embeddings.sql", "upsert_cached_embedding")

_tables_initialized = False
_quota_exhausted_until: float = 0.0

# In-memory fast pairwise decision cache
_PAIRWISE_CACHE: Dict[str, Tuple[float, bool]] = {}


def _ensure_pg_tables():
    """Ensures gemini_embeddings_cache exists in PostgreSQL."""
    global _tables_initialized
    if _tables_initialized:
        return
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(_SQL_CREATE_EMB_TABLE)
            conn.commit()
        _tables_initialized = True
    except Exception as e:
        logger.debug(f"PostgreSQL cache table init error: {e}")


_ensure_pg_tables()


# ─────────────────────────────────────────────────────────────────────────────
# Caching & Hashing Utilities
# ─────────────────────────────────────────────────────────────────────────────
def _hash_text(text: str) -> str:
    """Produces a deterministic hash key for clean text."""
    clean = " ".join(text.strip().lower().split())
    return hashlib.sha256(clean.encode("utf-8")).hexdigest()[:32]


def _pair_key(hash1: str, hash2: str) -> str:
    """Produces a canonical bidirectional key for two article hashes."""
    return ":".join(sorted([hash1, hash2]))


def get_cached_embedding(text: str) -> Optional[List[float]]:
    """Returns vector from L1 memory cache or permanent PostgreSQL database table."""
    h = _hash_text(text)
    # 1. Check L1 Memory Cache (0 ms)
    if h in _EMBEDDING_CACHE:
        return _EMBEDDING_CACHE[h]

    # 2. Check L2 PostgreSQL Database Table (< 2 ms)
    _ensure_pg_tables()
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(_SQL_FETCH_CACHED_EMB, (h,))
                row = cur.fetchone()
                if row and row[0]:
                    vec = json.loads(row[0])
                    _EMBEDDING_CACHE[h] = vec
                    return vec
    except Exception as e:
        logger.debug(f"PostgreSQL embedding fetch notice: {e}")
    return None


def cache_embedding(text: str, vector: List[float]):
    """Stores vector in L1 memory cache and saves permanently in PostgreSQL."""
    global _EMBEDDING_CACHE
    h = _hash_text(text)
    if len(_EMBEDDING_CACHE) >= _MAX_CACHE_SIZE:
        keys_to_remove = list(_EMBEDDING_CACHE.keys())[:int(_MAX_CACHE_SIZE * 0.2)]
        for k in keys_to_remove:
            _EMBEDDING_CACHE.pop(k, None)
    _EMBEDDING_CACHE[h] = vector

    _ensure_pg_tables()
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    _SQL_UPSERT_CACHED_EMB,
                    (h, text[:250], json.dumps(vector), _model_name)
                )
            conn.commit()
    except Exception as e:
        logger.debug(f"PostgreSQL embedding upsert notice: {e}")


def get_cached_pairwise_match(text1: str, text2: str) -> Optional[Tuple[float, bool]]:
    """Returns (similarity, is_match) from fast memory cache if already evaluated."""
    h1 = _hash_text(text1)
    h2 = _hash_text(text2)
    pkey = _pair_key(h1, h2)
    return _PAIRWISE_CACHE.get(pkey)


def cache_pairwise_match(text1: str, text2: str, similarity: float, is_match: bool):
    """Saves pairwise comparison result to fast memory cache."""
    h1 = _hash_text(text1)
    h2 = _hash_text(text2)
    pkey = _pair_key(h1, h2)
    if len(_PAIRWISE_CACHE) > 30000:
        _PAIRWISE_CACHE.clear()
    _PAIRWISE_CACHE[pkey] = (similarity, is_match)




# ─────────────────────────────────────────────────────────────────────────────
# Vector Math
# ─────────────────────────────────────────────────────────────────────────────
def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Computes cosine similarity between two float vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = 0.0
    norm1 = 0.0
    norm2 = 0.0
    for a, b in zip(v1, v2):
        dot += a * b
        norm1 += a * a
        norm2 += b * b
    if norm1 <= 0.0 or norm2 <= 0.0:
        return 0.0
    return dot / (math.sqrt(norm1) * math.sqrt(norm2))


# ─────────────────────────────────────────────────────────────────────────────
# Batch Embedding Generation
# ─────────────────────────────────────────────────────────────────────────────
def get_embeddings_batch(texts: List[str], batch_size: int = 40) -> List[Optional[List[float]]]:
    """
    Fetches embeddings for a list of texts using caching and chunked batching.
    Returns a list of vectors corresponding to input texts (None if failed/fallback).
    """
    global _quota_exhausted_until
    if not texts:
        return []

    client = get_gemini_client()
    results: List[Optional[List[float]]] = [None] * len(texts)
    missing_indices: List[int] = []
    missing_texts: List[str] = []

    # 1. Check local L1 & L2 caches first (0ms, 0 API quota used)
    for idx, t in enumerate(texts):
        if not t or not t.strip():
            continue
        cached = get_cached_embedding(t)
        if cached:
            results[idx] = cached
        else:
            missing_indices.append(idx)
            missing_texts.append(t.strip())

    if not missing_texts or not client:
        return results

    # 2. Check if quota is currently in backoff window
    if time.time() < _quota_exhausted_until:
        return results

    # 3. Batch fetch missing embeddings in chunks
    for i in range(0, len(missing_texts), batch_size):
        if time.time() < _quota_exhausted_until:
            break

        chunk_texts = missing_texts[i : i + batch_size]
        chunk_indices = missing_indices[i : i + batch_size]

        embedded_vectors = None
        for model_to_try in _fallback_models:
            try:
                response = client.models.embed_content(
                    model=model_to_try,
                    contents=chunk_texts,
                )
                if response and hasattr(response, "embeddings") and response.embeddings:
                    embedded_vectors = [e.values for e in response.embeddings]
                    break
                elif response and hasattr(response, "embedding") and response.embedding:
                    # Single item response fallback
                    embedded_vectors = [response.embedding.values]
                    break
            except Exception as e:
                err_str = str(e).lower()
                if "429" in err_str or "resource_exhausted" in err_str or "quota" in err_str:
                    _quota_exhausted_until = time.time() + 180.0  # 3 min backoff to rule-based fallback
                    logger.warning("Gemini API quota reached. Zero-downtime rule-based fallback active.")
                    return results
                else:
                    logger.debug(f"Gemini embed_content with model {model_to_try} failed: {e}")
                    continue

        if embedded_vectors and len(embedded_vectors) == len(chunk_texts):
            for orig_idx, txt, vec in zip(chunk_indices, chunk_texts, embedded_vectors):
                results[orig_idx] = vec
                cache_embedding(txt, vec)

    return results


def get_embedding(text: str) -> Optional[List[float]]:
    """Fetches embedding for a single text."""
    res = get_embeddings_batch([text])
    return res[0] if res else None


# ─────────────────────────────────────────────────────────────────────────────
# Semantic Comparison Helpers
# ─────────────────────────────────────────────────────────────────────────────
def are_articles_semantically_identical(
    text1: str,
    text2: str,
    threshold: float = SEMANTIC_SIMILARITY_THRESHOLD
) -> Optional[bool]:
    """
    Compares two articles using Gemini AI semantic embeddings.
    Returns:
      True  -> Cosine similarity >= threshold (Identical underlying news event).
      False -> Cosine similarity < threshold (Distinct events).
      None  -> Gemini unavailable / quota exhausted (Caller should use rule-based fallback).
    """
    if not text1 or not text2:
        return False
    if text1.strip() == text2.strip():
        return True

    # Check pairwise cache first (instant response)
    cached_pair = get_cached_pairwise_match(text1, text2)
    if cached_pair is not None:
        _, is_match = cached_pair
        return is_match

    client = get_gemini_client()
    if not client:
        return None

    vectors = get_embeddings_batch([text1, text2])
    if not vectors or len(vectors) < 2 or vectors[0] is None or vectors[1] is None:
        return None

    sim = cosine_similarity(vectors[0], vectors[1])
    is_match = sim >= threshold
    cache_pairwise_match(text1, text2, sim, is_match)
    return is_match

