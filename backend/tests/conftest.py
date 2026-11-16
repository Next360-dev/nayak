import pytest


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
    yield
