"""
Role-aware home dashboards (needs a throwaway Postgres; see test_shares.py).
"""
import json
import os
import pathlib

import pytest

if not os.getenv("ASO_TEST_DB"):
    pytest.skip("set ASO_TEST_DB=1 and DB_* to a throwaway database", allow_module_level=True)

from fastapi.testclient import TestClient

from app.core.database import get_connection
from app.core.security import hash_password

MIG = pathlib.Path(__file__).parents[1] / "migrations"
PW = "correct-horse-1"


@pytest.fixture(scope="module")
def client():
    c = get_connection(); cur = c.cursor()
    cur.execute("DROP TABLE IF EXISTS team_task_notes, team_tasks, briefing_edits, story_feedback, app_feedback, notification_log, audit_log, refresh_tokens, device_tokens, saved_stories, share_replies, share_recipients, shares, "
                "social_media_posts, tasks, political_representatives, new_articles, archive_news, users CASCADE")
    c.commit()
    cur.execute((MIG / "000_base_schema.sql").read_text())
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "005_audit_and_password_age.sql").read_text())  # password age + audit log
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "006_alerts_feedback.sql").read_text())  # contacts + alerts
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "007_team_board.sql").read_text())  # team board
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "008_leader_title.sql").read_text())  # leader title
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "009_must_change_password.sql").read_text())  # must change password
    for f in ("001_auth_and_shares.sql", "003_mobile.sql", "004_share_pair_guard.sql", "011_saved_stories.sql"):
        cur.execute((MIG / f).read_text())
    cur.execute("""CREATE TABLE IF NOT EXISTS archive_news (id BIGINT PRIMARY KEY, title TEXT NOT NULL,
        district VARCHAR(100) DEFAULT 'Statewide', constituency VARCHAR(100) DEFAULT 'Statewide',
        constituencies TEXT[] DEFAULT '{}', civic_constituencies TEXT[] DEFAULT '{}', state VARCHAR(100) DEFAULT 'Telangana',
        summary TEXT, sources JSONB DEFAULT '[]'::jsonb, published_at TIMESTAMPTZ, created_at TIMESTAMPTZ,
        sentiment VARCHAR(20) DEFAULT 'positive', is_statewide BOOLEAN DEFAULT FALSE, archived_at TIMESTAMPTZ DEFAULT now())""")
    h = hash_password(PW)
    for u, role, pol, con, dist, boss in [
        ("admin", "admin", "Admin", "All", "All", None),
        ("mla_s", "mla", "MLA S", "Sircilla", "Rajanna Sircilla", None),
        ("min_x", "minister", "Min X", "All", "All", None),
        ("staff_s", "staff", "", "", "", "mla_s"),
        ("staff_m", "staff", "", "", "", "min_x"),
    ]:
        cur.execute("INSERT INTO users (username,password_hash,role,politician_name,constituency_name,district_name,mla_username)"
                    " VALUES (%s,%s,%s,%s,%s,%s,%s)", (u, h, role, pol, con, dist, boss))
    src = json.dumps([{"publisher": "Test Paper", "url": "https://example.com/a"}])
    for title, dist, cons, senti in [
        ("Road repair begins in Sircilla", "Rajanna Sircilla", "Sircilla", "positive"),
        ("Water shortage protest in Sircilla", "Rajanna Sircilla", "Sircilla", "negative"),
        ("Hospital upgrade in Siddipet", "Siddipet", "Gajwel", "positive"),
        ("Farmers protest crop loss in Siddipet", "Siddipet", "Gajwel", "negative"),
    ]:
        cur.execute("INSERT INTO new_articles (title,district,constituency,summary,sources,sentiment,constituencies) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s)", (title, dist, cons, "Summary text.", src, senti, [cons]))
    c.commit(); cur.close(); c.close()
    from app.main import app
    return TestClient(app)


def hdr(c, u):
    r = c.post("/api/login", json={"username": u, "password": PW}).json()
    assert r["status"] == "success", r
    return {"Authorization": f"Bearer {r['token']}"}


def dash(c, u):
    r = c.get("/api/dashboard", headers=hdr(c, u))
    assert r.status_code == 200, r.text
    return r.json()


def test_requires_login(client):
    assert client.get("/api/dashboard").status_code == 401


def test_each_login_gets_its_own_kind(client):
    assert {u: dash(client, u)["kind"] for u in ("admin", "mla_s", "min_x", "staff_s", "staff_m")} == {
        "admin": "admin", "mla_s": "mla", "min_x": "minister", "staff_s": "staff", "staff_m": "staff"}


def test_mla_and_their_staff_see_only_their_constituency(client):
    mla, staff = dash(client, "mla_s"), dash(client, "staff_s")
    for d in (mla, staff):
        assert d["scope"] == {"statewide": False, "label": "Sircilla"}
        assert d["news"]["today"] == 2
        assert all(s["constituency_name"] == "Sircilla" for s in d["news"]["attention"])
        assert "districts" not in d["news"]
    assert mla["news"]["negative"] == 1
    assert [t["username"] for t in mla["team"]] == ["staff_s"]
    assert staff["leader"]["username"] == "mla_s"


def test_minister_and_their_staff_see_the_whole_state(client):
    mini, staff = dash(client, "min_x"), dash(client, "staff_m")
    assert mini["scope"]["statewide"] is True and staff["scope"]["statewide"] is True
    assert mini["news"]["today"] == 4 and staff["news"]["today"] == 4
    assert {d["district"] for d in mini["news"]["districts"]} == {"Rajanna Sircilla", "Siddipet"}   # minister-only block
    assert "districts" not in staff["news"]
    assert [t["username"] for t in mini["team"]] == ["staff_m"]


def test_share_numbers_follow_the_flow(client):
    st, m = hdr(client, "staff_s"), hdr(client, "mla_s")
    sid = client.post("/api/shares", headers=st, json={"title": "Water issue", "recipients": ["mla_s"], "priority": "urgent"}).json()["share_id"]
    mla, staff = dash(client, "mla_s"), dash(client, "staff_s")
    assert mla["shares"]["inbox"]["new"] == 1 and mla["shares"]["inbox"]["recent"][0]["sender"] == "staff_s"
    assert staff["shares"]["sent"]["waiting"] == 1 and staff["shares"]["inbox"]["new"] == 0
    client.patch(f"/api/shares/{sid}/status", headers=m, json={"status": "acting"})
    mla, staff = dash(client, "mla_s"), dash(client, "staff_s")
    assert mla["shares"]["inbox"]["acting"] == 1 and mla["shares"]["inbox"]["new"] == 0
    assert staff["shares"]["sent"]["acting"] == 1 and staff["shares"]["sent"]["waiting"] == 0
    # another leader's dashboard is unaffected
    assert dash(client, "min_x")["shares"]["inbox"] == {"new": 0, "seen": 0, "acting": 0, "done": 0, "recent": []}


def test_leader_home_shows_the_staff_note_on_each_pick(client):
    """The leader's "Picked for you" cards need the staff's note and link, and only for their own inbox."""
    st = hdr(client, "staff_s")
    client.post("/api/shares", headers=st, json={"title": "Road broken", "note": "Please see today", "url": "https://example.org/a",
                                                  "recipients": ["mla_s"], "priority": "normal"})
    pick = [r for r in dash(client, "mla_s")["shares"]["inbox"]["recent"] if r["title"] == "Road broken"][0]
    assert pick["note"] == "Please see today" and pick["url"] == "https://example.org/a"
    assert not any(r["title"] == "Road broken" for r in dash(client, "min_x")["shares"]["inbox"]["recent"])


def test_admin_control_room(client):
    d = dash(client, "admin")
    assert d["system"]["database"] == "up" and "scraper" in d["system"]
    assert {l["username"] for l in d["leaders"]} == {"mla_s", "min_x"}
    assert d["users"]["by_role"] == {"admin": 1, "mla": 1, "minister": 1, "staff": 2}
    assert d["shares"]["total"] >= 1 and d["shares"]["acting"] >= 1
    assert d["activity"][0]["sender"] == "staff_s"
    assert any(a["action"] == "users" and "never logged in" in a["text"] for a in d["attention"]) or d["users"]["never_logged_in"] == 0
    assert "news" not in d and "team" not in d            # admin gets the control room, not a news scope
    assert "password_hash" not in json.dumps(d)


def test_news_numbers_are_shared_inside_a_scope_but_never_across_scopes(client, monkeypatch):
    from app.services import dashboard_service, news_service
    real, calls = news_service.get_news_feed, []
    monkeypatch.setattr(news_service, "get_news_feed", lambda **kw: calls.append(kw.get("user_constituency")) or real(**kw))
    dashboard_service._news_cache.clear()
    a, b = dash(client, "mla_s"), dash(client, "staff_s")          # MLA + their staff: same scope
    assert len(calls) == 1 and a["news"]["today"] == b["news"]["today"] == 2
    m = dash(client, "min_x")                                       # minister: a different scope, computed separately
    assert len(calls) == 2 and m["news"]["today"] == 4
    assert dash(client, "mla_s")["news"]["today"] == 2 and len(calls) == 2   # repeated: served from the cache


# ── weekly summary (real rows only) ──────────────────────────────────────────
def test_week_counts_come_from_real_shares(client):
    sh = hdr(client, "staff_s")
    r = client.post("/api/shares", headers=sh, json={"title": "Week story", "url": "https://example.com/w", "recipients": ["mla_s"]})
    assert r.status_code == 200, r.text
    share_id = r.json()["share_id"]
    before = dash(client, "mla_s")["shares"]["week"]
    assert before["received"] >= 1
    handled_before = before["handled"]
    done = client.patch(f"/api/shares/{share_id}/status", headers=hdr(client, "mla_s"), json={"status": "done"})
    assert done.status_code == 200, done.text
    after = dash(client, "mla_s")["shares"]["week"]
    assert after["handled"] == handled_before + 1
    # the staff member sees the same share on the sent side
    staff_week = dash(client, "staff_s")["shares"]["week"]
    assert staff_week["sent"] >= 1 and staff_week["sent_done"] >= 1


# ── saved stories ────────────────────────────────────────────────────────────
STORY = {"article_id": 42, "title": "Saved road story", "url": "https://example.com/s", "place": "Sircilla", "tone": "positive"}


def test_saved_requires_login(client):
    assert client.get("/api/saved").status_code == 401
    assert client.post("/api/saved", json=STORY).status_code == 401


def test_save_list_and_remove(client):
    h = hdr(client, "mla_s")
    first = client.post("/api/saved", headers=h, json=STORY)
    assert first.status_code == 200, first.text
    saved_id = first.json()["story"]["id"]
    again = client.post("/api/saved", headers=h, json=STORY)  # saving twice is fine and does not duplicate
    assert again.json()["story"]["id"] == saved_id
    listed = client.get("/api/saved", headers=h).json()["stories"]
    assert [s["title"] for s in listed].count("Saved road story") == 1
    assert client.delete(f"/api/saved/{saved_id}", headers=h).status_code == 200
    assert client.delete(f"/api/saved/{saved_id}", headers=h).status_code == 404


def test_saved_is_private(client):
    mine = client.post("/api/saved", headers=hdr(client, "mla_s"), json={**STORY, "article_id": 43, "title": "Private one"})
    saved_id = mine.json()["story"]["id"]
    other = hdr(client, "min_x")
    assert all(s["title"] != "Private one" for s in client.get("/api/saved", headers=other).json()["stories"])
    assert client.delete(f"/api/saved/{saved_id}", headers=other).status_code == 404  # cannot remove someone else's


def test_save_needs_an_id_or_link_and_a_valid_date(client):
    h = hdr(client, "mla_s")
    assert client.post("/api/saved", headers=h, json={"title": "No id, no link"}).status_code == 422
    assert client.post("/api/saved", headers=h, json={**STORY, "published_at": "not a date"}).status_code == 422
