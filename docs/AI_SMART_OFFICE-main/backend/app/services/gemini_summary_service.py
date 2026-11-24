"""
app/services/gemini_summary_service.py
Re-exports gemini_summary_service from backend root.
"""
import os
import sys

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from gemini_summary_service import (
    generate_natural_summary,
    smart_natural_fallback
)
