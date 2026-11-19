"""
Guards against fabricated social media data (needs a throwaway Postgres; see test_shares.py).
"""
import os
import pathlib
import urllib.request

import pytest

if not os.getenv("ASO_TEST_DB"):
    pytest.skip("set ASO_TEST_DB=1 and DB_* to a throwaway database", allow_module_level=True)

from fastapi.testclient import TestClient

import social_media_scraper as scraper
from app.core.database import get_connection
from app.core.security import hash_password

ROOT = pathlib.Path(__file__).parents[1]
PW = "correct-horse-1"

SCHEMA = """
DROP TABLE IF EXISTS team_task_notes, team_tasks, briefing_edits, social_media_posts, share_replies, share_recipients, shares, users CASCADE;
CREATE TABLE users (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, role TEXT NOT NULL,
  politician_name TEXT, constituency_name TEXT, district_name TEXT, last_login TIMESTAMPTZ);
CREATE TABLE social_media_posts (
  id SERIAL PRIMARY KEY, platform TEXT, post_id TEXT, mla_name TEXT, constituency TEXT, district TEXT,
  author_handle TEXT, author_name TEXT, content TEXT, url TEXT, media_url TEXT,
  likes_count INT NOT NULL DEFAULT 0, shares_count INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0, views_count INT NOT NULL DEFAULT 0,
  sentiment TEXT, sentiment_reason TEXT, published_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (platform, url));
"""


def count():
    c = get_connection(); cur = c.cursor()
    cur.execute("SELECT COUNT(*) FROM social_media_posts"); n = cur.fetchone()[0]
    c.close(); return n


@pytest.fixture(scope="module")
def client():
    c = get_connection(); cur = c.cursor()
    cur.execute(SCHEMA)
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "005_audit_and_password_age.sql").read_text())  # password age + audit log
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "006_alerts_feedback.sql").read_text())  # contacts + alerts
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "007_team_board.sql").read_text())  # team board
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "008_leader_title.sql").read_text())  # leader title
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "009_must_change_password.sql").read_text())  # must change password
    cur.execute((ROOT / "migrations" / "001_auth_and_shares.sql").read_text())
    cur.execute((ROOT / "migrations" / "002_social_metrics_nullable.sql").read_text())
    cur.execute((ROOT / "migrations" / "002_social_metrics_nullable.sql").read_text())  # re-runnable
    cur.execute("INSERT INTO users (username,password_hash,role,politician_name,constituency_name,district_name) "
                "VALUES ('admin',%s,'admin','Admin','All','All')", (hash_password(PW),))
    c.commit(); c.close()
    from app.main import app
    cl = TestClient(app)
    tok = cl.post("/api/login", json={"username": "admin", "password": PW}).json()["token"]
    cl.headers.update({"Authorization": f"Bearer {tok}"})
    return cl


def test_scraper_module_has_no_fake_data_generators():
    assert not hasattr(scraper, "seed_social_media_posts_for_mla")
    assert not hasattr(scraper, "generate_engagement_metrics")


def test_opening_feed_does_not_invent_posts(client):
    r = client.get("/api/social_media", params={"constituency": "Kodangal", "period": "history"}).json()
    assert r["status"] == "success"
    assert count() == 0


def test_scrape_with_no_results_adds_nothing(client, monkeypatch):
    def boom(*a, **k):
        raise OSError("no network in tests")
    monkeypatch.setattr(urllib.request, "urlopen", boom)
    r = client.post("/api/social_media/scrape", params={"constituency": "Kodangal"}).json()
    assert r["saved_count"] == 0
    assert count() == 0


def test_real_item_is_saved_with_unknown_engagement(client):
    post = {"platform": "youtube", "post_id": "y1", "mla_name": "Test MLA", "constituency": "Kodangal",
            "district": "Vikarabad", "author_handle": "@x", "author_name": "X", "content": "Road repaired",
            "url": "https://news.google.com/rss/articles/abc", "media_url": None,
            "likes_count": None, "shares_count": None, "comments_count": None, "views_count": None,
            "sentiment": "positive", "sentiment_reason": "r",
            "published_at": "2026-11-10T10:00:00+00:00", "created_at": "2026-11-10T10:00:00+00:00"}
    assert scraper.save_social_posts_to_db([post])[0] == 1
    posts = client.get("/api/social_media", params={"constituency": "Kodangal", "period": "history"}).json()["posts"]
    assert len(posts) == 1
    assert all(posts[0][k] is None for k in ("likes_count", "shares_count", "comments_count", "views_count"))


def test_purge_script_dry_run_then_apply(client):
    c = get_connection(); cur = c.cursor()
    cur.execute("INSERT INTO social_media_posts (platform,url,content,mla_name,constituency) "
                "VALUES ('twitter','https://x.com/fake/status/1','invented','M','Kodangal')")
    cur.execute("UPDATE social_media_posts SET likes_count=999 WHERE url LIKE 'https://news.google.com/%'")
    c.commit(); c.close()
    import importlib.util
    spec = importlib.util.spec_from_file_location("purge", ROOT / "scripts" / "purge_fabricated_social_posts.py")
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)

    mod.main(apply=False)
    assert count() == 2                      # dry run changes nothing
    mod.main(apply=True)
    assert count() == 1                      # seeded row gone, real row kept
    c = get_connection(); cur = c.cursor()
    cur.execute("SELECT likes_count FROM social_media_posts"); assert cur.fetchone()[0] is None
    c.close()
