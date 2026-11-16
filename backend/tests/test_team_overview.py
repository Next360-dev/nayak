"""
Master-admin overview + MLA/minister "My team" (needs a throwaway Postgres; see test_shares.py).
"""
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

BASE = """
DROP TABLE IF EXISTS team_task_notes, team_tasks, briefing_edits, new_articles, refresh_tokens, device_tokens, share_replies, share_recipients, shares, users CASCADE;
CREATE TABLE users (
  username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, role TEXT NOT NULL,
  politician_name TEXT, constituency_name TEXT, district_name TEXT, last_login TIMESTAMPTZ
);
CREATE TABLE new_articles (id SERIAL PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT now());
"""


@pytest.fixture(scope="module")
def client():
    conn = get_connection(); cur = conn.cursor()
    cur.execute(BASE)
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "005_audit_and_password_age.sql").read_text())  # password age + audit log
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "006_alerts_feedback.sql").read_text())  # contacts + alerts
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "007_team_board.sql").read_text())  # team board
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "008_leader_title.sql").read_text())  # leader title
    cur.execute((MIG / "001_auth_and_shares.sql").read_text())
    cur.execute((MIG / "003_mobile.sql").read_text())
    cur.execute((MIG / "004_share_pair_guard.sql").read_text())
    h = hash_password(PW)
    for u, role, pol, con, dist, boss in [
        ("admin", "admin", "Admin", "All", "All", None),
        ("mla_a", "mla", "MLA A", "Sircilla", "Rajanna", None),
        ("mla_b", "mla", "MLA B", "Mulugu", "Mulugu", None),
        ("min_x", "minister", "Min X", "Gajwel", "Siddipet", None),
        ("staff_a", "staff", "", "", "", "mla_a"),
        ("staff_b", "staff", "", "", "", "mla_b"),
    ]:
        cur.execute("INSERT INTO users (username,password_hash,role,politician_name,constituency_name,district_name,mla_username)"
                    " VALUES (%s,%s,%s,%s,%s,%s,%s)", (u, h, role, pol, con, dist, boss))
    conn.commit(); cur.close(); conn.close()
    from app.main import app
    return TestClient(app)


def login(c, user, pw=PW):
    return c.post("/api/login", json={"username": user, "password": pw}).json()


def hdr(c, user, pw=PW):
    r = login(c, user, pw)
    assert r["status"] == "success", r
    return {"Authorization": f"Bearer {r['token']}"}


# ── master admin overview ────────────────────────────────────────────────────
def test_overview_is_admin_only(client):
    assert client.get("/api/admin/overview").status_code == 401
    for u in ("mla_a", "min_x", "staff_a"):
        assert client.get("/api/admin/overview", headers=hdr(client, u)).status_code == 403


def test_overview_shows_every_leader_with_activity(client):
    admin = hdr(client, "admin")
    # staff feed their own leaders (the admin never shares)
    r = client.post("/api/shares", headers=hdr(client, "staff_a"), json={
        "title": "Road collapse", "url": "http://x/1", "priority": "urgent", "recipients": ["mla_a"]})
    assert r.status_code == 200, r.text
    sid = r.json()["share_id"]
    assert client.post("/api/shares", headers=hdr(client, "staff_b"), json={
        "title": "Water issue", "recipients": ["mla_b"]}).status_code == 200
    client.patch(f"/api/shares/{sid}/status", headers=hdr(client, "mla_a"), json={"status": "acting"})

    data = client.get("/api/admin/overview", headers=admin).json()
    by = {x["username"]: x for x in data["leaders"]}
    assert set(by) == {"mla_a", "mla_b", "min_x"}          # no admin, no staff
    assert by["mla_a"]["staff_count"] == 1
    assert by["mla_a"]["shares"]["acting"] == 1 and by["mla_a"]["shares"]["new"] == 0
    assert by["mla_b"]["shares"]["new"] == 1 and by["mla_b"]["oldest_unseen_share"]
    assert by["mla_a"]["last_login"]                        # they logged in above
    assert by["mla_b"]["last_login"] is None               # has never logged in
    assert data["totals"]["never_logged_in"] >= 1
    assert data["totals"]["unseen_shares"] >= 1
    sysh = data["system"]
    assert sysh["database"] == "up" and "scraper" in sysh
    assert sysh["news_is_stale"] is True and sysh["articles_last_24h"] == 0   # no scraper ran in this test DB
    assert "password_hash" not in str(data)


# ── my team ──────────────────────────────────────────────────────────────────
def test_team_only_for_mla_and_minister(client):
    assert client.get("/api/team").status_code == 401
    assert client.get("/api/team", headers=hdr(client, "admin")).status_code == 403
    assert client.get("/api/team", headers=hdr(client, "staff_a")).status_code == 403
    r = client.get("/api/team", headers=hdr(client, "mla_a")).json()
    assert [s["username"] for s in r["staff"]] == ["staff_a"]


def test_leader_creates_staff_who_work_in_leaders_inbox(client):
    a = hdr(client, "mla_a")
    r = client.post("/api/team/create", headers=a, json={"username": "NewStaff", "password": PW,
                                                         "role": "admin", "mla_username": "mla_b"})  # extras ignored
    assert r.status_code == 200, r.text
    me = client.get("/api/me", headers=hdr(client, "newstaff")).json()["user"]
    assert me["role"] == "staff"
    assert me["constituency_name"] == "Sircilla"             # inherited from mla_a, not mla_b
    assert "newstaff" in [s["username"] for s in client.get("/api/team", headers=a).json()["staff"]]
    assert "newstaff" not in [s["username"] for s in client.get("/api/team", headers=hdr(client, "mla_b")).json()["staff"]]


def test_team_create_validation(client):
    a = hdr(client, "mla_a")
    assert client.post("/api/team/create", headers=a, json={"username": "x1", "password": "short"}).status_code == 422
    assert client.post("/api/team/create", headers=a, json={"username": "mla_b", "password": PW}).status_code == 409


def test_leader_cannot_touch_another_leaders_staff(client):
    b = hdr(client, "mla_b")
    for path, body in [("reset-password", {"username": "staff_a", "new_password": "hijacked-pass-1"}),
                       ("set-active", {"username": "staff_a", "active": False})]:
        assert client.post(f"/api/team/{path}", headers=b, json=body).status_code == 404
    assert login(client, "staff_a")["status"] == "success"   # untouched
    # and cannot target a non-staff account
    assert client.post("/api/team/reset-password", headers=b,
                       json={"username": "mla_a", "new_password": "hijacked-pass-1"}).status_code == 404


def test_leader_resets_own_staff_password(client):
    a = hdr(client, "mla_a")
    r = client.post("/api/team/reset-password", headers=a, json={"username": "staff_a", "new_password": "fresh-pass-22"})
    assert r.status_code == 200
    assert login(client, "staff_a", PW)["status"] != "success"
    assert login(client, "staff_a", "fresh-pass-22")["status"] == "success"
    assert client.post("/api/team/reset-password", headers=a,
                       json={"username": "staff_a", "new_password": "x"}).status_code == 422


def test_leader_can_disable_and_reenable_own_staff(client):
    a = hdr(client, "mla_a")
    old_token = hdr(client, "newstaff")
    assert client.post("/api/team/set-active", headers=a, json={"username": "newstaff", "active": False}).status_code == 200
    assert login(client, "newstaff")["status"] != "success"
    assert client.get("/api/me", headers=old_token).status_code == 401   # live session dies too
    listed = {s["username"]: s["is_active"] for s in client.get("/api/team", headers=a).json()["staff"]}
    assert listed["newstaff"] is False
    # the username stays taken while disabled
    assert client.post("/api/team/create", headers=a, json={"username": "newstaff", "password": PW}).status_code == 409
    assert client.post("/api/team/set-active", headers=a, json={"username": "newstaff", "active": True}).status_code == 200
    assert login(client, "newstaff")["status"] == "success"


def test_minister_has_their_own_team(client):
    m = hdr(client, "min_x")
    assert client.post("/api/team/create", headers=m, json={"username": "min_staff", "password": PW}).status_code == 200
    assert [s["username"] for s in client.get("/api/team", headers=m).json()["staff"]] == ["min_staff"]
    me = client.get("/api/me", headers=hdr(client, "min_staff")).json()["user"]
    assert me["role"] == "staff" and me["scoped"] is False   # minister's staff see statewide
