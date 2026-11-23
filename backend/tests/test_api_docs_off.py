"""The API documentation pages must not be public by default (pure logic, no database)."""
import importlib
import os


def _app(flag):
    if flag is None:
        os.environ.pop("ENABLE_API_DOCS", None)
    else:
        os.environ["ENABLE_API_DOCS"] = flag
    import app.main as main
    return importlib.reload(main).app


def test_docs_are_off_by_default_and_on_with_the_switch():
    try:
        off = _app(None)
        assert off.docs_url is None and off.openapi_url is None and off.redoc_url is None
        on = _app("1")
        assert on.docs_url == "/docs" and on.openapi_url == "/openapi.json"
    finally:
        _app(None)
