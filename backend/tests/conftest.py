import os

import pytest

# Opening the social feed would start a real web crawl in the background; the test run must never do that.
os.environ.setdefault("SOCIAL_AUTO_CRAWL", "0")


@pytest.fixture(autouse=True)
def _fresh_caches():
    """The news caches live in the process; tests share a process but not a database, so start each test clean."""
    try:
        from app.api.routes import news
        from app.services import dashboard_service
        news._feed_cache.clear()
        dashboard_service._news_cache.clear()
    except Exception:
        pass  # pure-logic tests that never import the app
    try:
        # Login throttles are also per-process in-memory state; one test's failed
        # logins must not leak a 429 into the next test.
        from app.services import auth_service
        with auth_service._RATE_LIMIT_LOCK:
            auth_service._RATE_LIMITS.clear()
    except Exception:
        pass
    yield
