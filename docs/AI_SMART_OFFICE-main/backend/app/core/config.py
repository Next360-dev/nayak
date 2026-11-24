"""
core/config.py - Application Settings & Environment Configuration
Loads all configuration from .env file via python-dotenv.
"""

import os
from dotenv import load_dotenv

# Load .env from backend root (three levels up from core/config.py) or app/ or cwd
_CORE_DIR = os.path.dirname(os.path.abspath(__file__))
_APP_DIR = os.path.dirname(_CORE_DIR)
_BACKEND_DIR = os.path.dirname(_APP_DIR)

load_dotenv(os.path.join(_BACKEND_DIR, ".env"))
load_dotenv(os.path.join(_APP_DIR, ".env"))
load_dotenv()  # Also pick up any system-level env vars or cwd



class Settings:
    # ── Database (Strictly loaded from .env - No hardcoded secrets in Git) ──
    DB_HOST: str = os.getenv("DB_HOST", "")
    DB_PORT: int = int(os.getenv("DB_PORT", "5432"))
    DB_NAME: str = os.getenv("DB_NAME", "")
    DB_USER: str = os.getenv("DB_USER", "")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "")

    # ── API Server ────────────────────────────────────────────────
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))
    API_BASE_URL: str = os.getenv("API_BASE_URL", f"http://{HOST}:{PORT}")

    # ── Scraper / Automation (Runs on boot, then every 3 hours) ───
    SCRAPE_INTERVAL_SECONDS: int = int(os.getenv("SCRAPE_INTERVAL_SECONDS", "10800"))  # 3 hours (10,800s)
    SCRAPE_INITIAL_DELAY_SECONDS: int = int(os.getenv("SCRAPE_INITIAL_DELAY_SECONDS", "5"))

    # ── AI / Gemini (Strictly loaded from .env) ────────────────────
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")

    # ── Backend Directory (useful for referencing sibling files) ──
    BACKEND_DIR: str = _BACKEND_DIR


settings = Settings()
