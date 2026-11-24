"""
app/services/gemini_embedding_service.py
Re-exports gemini_embedding_service from the backend root.
"""
import os
import sys

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from gemini_embedding_service import (
    get_gemini_client,
    is_gemini_available,
    get_embedding,
    get_embeddings_batch,
    cosine_similarity,
    are_articles_semantically_identical,
    SEMANTIC_SIMILARITY_THRESHOLD,
    _EMBEDDING_CACHE
)
