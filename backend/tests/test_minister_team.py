"""
Minister and minister's team rules (needs a throwaway Postgres; see test_shares.py).
  - staff can work for a minister, not only an MLA
  - minister and their staff are NOT limited to one constituency; MLA staff still are
  - minister can run a social scrape
"""
import os
import pathlib
import urllib.request

import pytest

if not os.getenv("ASO_TEST_DB"):
    pytest.skip("set ASO_TEST_DB=1 and DB_* to a throwaway database", allow_module_level=True)

from fastapi.testclient import TestClient

from app.core.database import get_connection
from app.core.security import hash_password

MIGRATION = pathlib.Path(__file__).parents[1] / "migrations" / "001_auth_and_shares.sql"
PW = "correct-horse-1"


@pytest.fixture(scope="module")
def client():
    c = get_connection(); cur = c.cursor()
    cur.execute("""
      DROP TABLE IF EXISTS team_task_notes, team_tasks, briefing_edits, social_media_posts, share_replies, share_recipients, shares, users CASCADE;
      CREATE TABLE users (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, role TEXT NOT NULL,
        politician_name TEXT, constituency_name TEXT, district_name TEXT, last_login TIMESTAMPTZ);""")
    cur.execute(MIGRATION.read_text())
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "005_audit_and_password_age.sql").read_text())  # password age + audit log
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "006_alerts_feedback.sql").read_text())  # contacts + alerts
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "007_team_board.sql").read_text())  # team board
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "008_leader_title.sql").read_text())  # leader title
    cur.execute((MIGRATION.parent / "004_share_pair_guard.sql").read_text())
    h = hash_password(PW)
    for u, role, pol, con, dist, boss in [
        ("admin", "admin", "Admin", "All", "All", None),
        ("mla_a", "mla", "MLA A", "Sircilla", "Rajanna", None),
        ("min_x", "minister", "Min X", "All", "All", None),
        ("staff_mla", "staff", "", "", "", "mla_a"),
        ("staff_min", "staff", "", "", "", "min_x"),
    ]:
        cur.execute("INSERT INTO users (username,password_hash,role,politician_name,constituency_name,"
                    "district_name,mla_username) VALUES (%s,%s,%s,%s,%s,%s,%s)", (u, h, role, pol, con, dist, boss))
    c.commit(); c.close()
    from app.main import app
    return TestClient(app)


def auth(c, user):
    t = c.post("/api/login", json={"username": user, "password": PW}).json()["token"]
    return {"Authorization": f"Bearer {t}"}


def test_scope_flags(client):
    scoped = {u: client.get("/api/me", headers=auth(client, u)).json()["user"]["scoped"]
              for u in ("admin", "mla_a", "min_x", "staff_mla", "staff_min")}
    assert scoped == {"admin": False, "mla_a": True, "min_x": False, "staff_mla": True, "staff_min": False}


def test_mla_staff_still_blocked_without_constituency_on_news(client):
    # a minister's team is not pinned, an MLA's team is
    r = client.get("/api/me", headers=auth(client, "staff_mla")).json()["user"]
    assert r["constituency_name"] == "Sircilla"


def test_admin_can_create_staff_for_minister_but_not_for_admin(client):
    a = auth(client, "admin")
    ok = client.post("/api/users/create", headers=a, json={
        "username": "staff_min2", "password": PW, "role": "staff", "mla_username": "min_x"})
    assert ok.status_code == 200
    assert client.get("/api/me", headers=auth(client, "staff_min2")).json()["user"]["scoped"] is False
    bad = client.post("/api/users/create", headers=a, json={
        "username": "staff_bad", "password": PW, "role": "staff", "mla_username": "admin"})
    assert bad.status_code == 422


def test_minister_staff_share_to_their_minister_and_keep_own_inbox(client):
    st = auth(client, "staff_min")
    r = client.post("/api/shares", headers=st, json={"title": "t", "recipients": ["min_x"]})
    assert r.status_code == 200
    assert len(client.get("/api/shares/inbox", headers=auth(client, "min_x")).json()["shares"]) == 1
    assert client.get("/api/shares/inbox", headers=st).json()["shares"] == []   # staff inbox is their own


def test_minister_can_run_social_scrape(client, monkeypatch):
    monkeypatch.setattr(urllib.request, "urlopen", lambda *a, **k: (_ for _ in ()).throw(OSError("offline")))
    r = client.post("/api/social_media/scrape", params={"constituency": "Kodangal"}, headers=auth(client, "min_x"))
    assert r.status_code == 200
