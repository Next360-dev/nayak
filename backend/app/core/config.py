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

    # ── Auth ──────────────────────────────────────────────────────
    # JWT_SECRET must be set in .env for any real deployment. If it is missing we
    # generate a random per-process secret (tokens stop working on restart) and warn.
    JWT_SECRET: str = os.getenv("JWT_SECRET", "")
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))
    # Mobile refresh-token lifetime (days). Only used by /api/token/refresh for mobile clients.
    MOBILE_REFRESH_DAYS: int = int(os.getenv("MOBILE_REFRESH_DAYS", "30"))
    # Comma-separated list of allowed browser origins for CORS.
    CORS_ORIGINS: list = [
        o.strip() for o in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",") if o.strip()
    ]

    # ── Alerts & briefing (email is OFF until SMTP_HOST and SMTP_FROM are set) ──
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "")
    SMTP_STARTTLS: bool = os.getenv("SMTP_STARTTLS", "true").lower() != "false"
    APP_BASE_URL: str = os.getenv("APP_BASE_URL", f"http://{HOST}:{PORT}")   # link shown inside alert emails
    ALERT_CHECK_MINUTES: int = int(os.getenv("ALERT_CHECK_MINUTES", "10"))    # how often alerts/briefings are checked
    BRIEFING_HOUR: int = int(os.getenv("BRIEFING_HOUR", "7"))                  # local hour the daily briefing goes out
    TIMEZONE: str = os.getenv("TIMEZONE", "Asia/Kolkata")

    # Without a Gemini key the tone is decided by keyword rules. By default a story with no negative word is labelled
    # "positive" (the original design). Set SENTIMENT_NEUTRAL_FALLBACK=true to label it "neutral" instead unless it contains
    # a clearly positive word. Neutral stories appear under All News only (no badge, not in the Positive or Negative tabs).
    SENTIMENT_NEUTRAL_FALLBACK: bool = os.getenv("SENTIMENT_NEUTRAL_FALLBACK", "false").lower() == "true"

    # ── Local AI for news tone (Ollama). OFF until OLLAMA_MODEL is set, e.g. OLLAMA_MODEL=gemma3:4b ──
    OLLAMA_URL: str = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "")
    OLLAMA_TIMEOUT_SECONDS: float = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "30"))
    OLLAMA_MAX_PER_CYCLE: int = int(os.getenv("OLLAMA_MAX_PER_CYCLE", "400"))              # stories the AI may label per scrape cycle
    OLLAMA_MAX_SECONDS_PER_CYCLE: int = int(os.getenv("OLLAMA_MAX_SECONDS_PER_CYCLE", "600"))  # time budget per cycle

    # ── Backend Directory (useful for referencing sibling files) ──
    BACKEND_DIR: str = _BACKEND_DIR


settings = Settings()

if os.getenv("APP_ENV", "").lower() == "production" and len(settings.JWT_SECRET) < 32:
    # Production must never run with a missing or short signing secret (everyone could be logged out on restart, or tokens forged).
    raise RuntimeError("APP_ENV=production needs JWT_SECRET with at least 32 characters. Set it in .env.production.")

if not settings.JWT_SECRET:
    import secrets
    import warnings
    settings.JWT_SECRET = secrets.token_urlsafe(48)
    warnings.warn(
        "JWT_SECRET is not set in .env; using a temporary secret. "
        "Logins will be invalidated on every restart.",
        RuntimeWarning,
    )
