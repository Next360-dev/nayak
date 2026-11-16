"""
Self-service password change, sessions ended by a password change, the audit log, and the DB-backed login lockout
(needs a throwaway Postgres; see test_shares.py).
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
NEW = "brand-new-pass-9"


@pytest.fixture(scope="module")
def client():
    c = get_connection(); cur = c.cursor()
    cur.execute("DROP TABLE IF EXISTS audit_log, refresh_tokens, device_tokens, share_replies, share_recipients, shares, users CASCADE")
    cur.execute("CREATE TABLE users (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, role TEXT NOT NULL, "
                "politician_name TEXT, constituency_name TEXT, district_name TEXT, last_login TIMESTAMPTZ)")
    for f in ("001_auth_and_shares.sql", "003_mobile.sql", "004_share_pair_guard.sql", "005_audit_and_password_age.sql"):
        cur.execute((MIG / f).read_text())
    h = hash_password(PW)
    for u, role, boss in [("admin", "admin", None), ("mla_a", "mla", None), ("staff_a", "staff", "mla_a"),
                          ("victim", "mla", None), ("locky", "mla", None)]:
        cur.execute("INSERT INTO users (username,password_hash,role,politician_name,constituency_name,district_name,mla_username) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s)", (u, h, role, u, "Sircilla", "Rajanna", boss))
    c.commit(); cur.close(); c.close()
    from app.main import app
    return TestClient(app)


def login(c, u, pw=PW):
    return c.post("/api/login", json={"username": u, "password": pw}).json()


def hdr(token):
    return {"Authorization": f"Bearer {token}"}


def audit(c, **q):
    token = login(c, "admin")["token"]
    return c.get("/api/audit", headers=hdr(token), params=q).json()["entries"]


# ── change my own password ───────────────────────────────────────────────────
def test_change_password_rules(client):
    t = login(client, "mla_a")["token"]
    assert client.post("/api/me/password", headers=hdr(t), json={"current_password": "wrong", "new_password": NEW}).status_code == 403
    assert client.post("/api/me/password", headers=hdr(t), json={"current_password": PW, "new_password": "short"}).status_code == 422
    assert client.post("/api/me/password", headers=hdr(t), json={"current_password": PW, "new_password": PW}).status_code == 422
    assert client.post("/api/me/password", json={"current_password": PW, "new_password": NEW}).status_code == 401


def test_change_password_ends_other_sessions_but_keeps_this_one(client):
    old_a, old_b = login(client, "staff_a")["token"], login(client, "staff_a")["token"]
    r = client.post("/api/me/password", headers=hdr(old_a), json={"current_password": PW, "new_password": NEW})
    assert r.status_code == 200
    fresh = r.json()["token"]
    assert client.get("/api/me", headers=hdr(fresh)).status_code == 200           # this session continues
    assert client.get("/api/me", headers=hdr(old_a)).status_code == 401           # every older session is dead
    assert client.get("/api/me", headers=hdr(old_b)).status_code == 401
    assert login(client, "staff_a", PW)["status"] != "success"
    assert login(client, "staff_a", NEW)["status"] == "success"


def test_admin_reset_ends_the_victims_open_session(client):
    victim = login(client, "victim")["token"]
    admin = login(client, "admin")["token"]
    assert client.post("/api/users/reset-password", headers=hdr(admin), json={"username": "victim", "new_password": NEW}).status_code == 200
    assert client.get("/api/me", headers=hdr(victim)).status_code == 401
    assert login(client, "victim", NEW)["status"] == "success"


# ── audit log ────────────────────────────────────────────────────────────────
def test_audit_is_admin_only(client):
    assert client.get("/api/audit").status_code == 401
    assert client.get("/api/audit", headers=hdr(login(client, "mla_a")["token"])).status_code == 403


def test_audit_records_who_did_what_and_never_secrets(client):
    admin = hdr(login(client, "admin")["token"])
    client.post("/api/users/create", headers=admin, json={"username": "newbie", "password": PW, "role": "mla"})
    client.post("/api/users/set-active", headers=admin, json={"username": "newbie", "active": False})
    mla = hdr(login(client, "mla_a")["token"])
    client.post("/api/team/create", headers=mla, json={"username": "helper", "password": PW})
    client.post("/api/team/reset-password", headers=mla, json={"username": "helper", "new_password": NEW})
    st = hdr(login(client, "helper", NEW)["token"])
    sid = client.post("/api/shares", headers=st, json={"title": "Water issue", "recipients": ["mla_a"], "priority": "urgent"}).json()["share_id"]
    client.patch(f"/api/shares/{sid}/status", headers=mla, json={"status": "acting"})

    entries = audit(client, limit=200)
    got = {(e["action"], e["actor"], e["target"]) for e in entries}
    assert ("user_created", "admin", "newbie") in got
    assert ("user_disabled", "admin", "newbie") in got
    assert ("user_created", "mla_a", "helper") in got
    assert ("password_reset", "mla_a", "helper") in got
    assert ("share_created", "helper", "mla_a") in got
    assert ("share_status", "mla_a", str(sid)) in got
    assert ("password_changed", "staff_a", "staff_a") in got                       # from the earlier test
    blob = str(entries)
    assert PW not in blob and NEW not in blob and "password_hash" not in blob and "$argon2" not in blob
    assert [e["action"] for e in audit(client, action="user_disabled")] == ["user_disabled"]
    assert all("helper" in str(e) for e in audit(client, q="helper"))


# ── login lockout now lives in the database ──────────────────────────────────
def test_lockout_counts_failures_in_the_audit_table_and_a_success_resets_it(client):
    for _ in range(3):
        assert login(client, "locky", "nope")["status"] != "success"
    assert login(client, "locky")["status"] == "success"            # success clears the count
    for _ in range(5):
        client.post("/api/login", json={"username": "locky", "password": "nope"})
    r = client.post("/api/login", json={"username": "locky", "password": PW})
    assert r.status_code == 429                                      # locked even with the right password
    n = get_connection(); cur = n.cursor()
    cur.execute("SELECT COUNT(*) FROM audit_log WHERE action='login_failed' AND target='locky'"); failed = cur.fetchone()[0]
    cur.close(); n.close()
    assert failed == 8


def test_admin_dashboard_carries_recent_audit(client):
    d = client.get("/api/dashboard", headers=hdr(login(client, "admin")["token"])).json()
    assert d["kind"] == "admin" and len(d["audit"]) >= 1 and "action" in d["audit"][0]
