import os
import pathlib

import pytest

if not os.getenv("ASO_TEST_DB"):
    pytest.skip("set ASO_TEST_DB=1 and DB_* to a throwaway database", allow_module_level=True)

from fastapi.testclient import TestClient

from app.core.database import get_connection
from app.core.security import hash_password

MIGRATION_001 = pathlib.Path(__file__).parents[1] / "migrations" / "001_auth_and_shares.sql"
MIGRATION_003 = pathlib.Path(__file__).parents[1] / "migrations" / "003_mobile.sql"
PW = "correct-horse-1"

BASE_USERS = """
DROP TABLE IF EXISTS team_task_notes, team_tasks, briefing_edits, story_feedback, app_feedback, notification_log, audit_log, refresh_tokens, device_tokens, share_replies, share_recipients, shares, users CASCADE;
CREATE TABLE users (
  username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, role TEXT NOT NULL,
  politician_name TEXT, constituency_name TEXT, district_name TEXT, last_login TIMESTAMPTZ,
  mla_username TEXT
);
"""


@pytest.fixture(scope="module")
def client():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(BASE_USERS)
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "005_audit_and_password_age.sql").read_text())  # password age + audit log
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "006_alerts_feedback.sql").read_text())  # contacts + alerts
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "007_team_board.sql").read_text())  # team board
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "008_leader_title.sql").read_text())  # leader title
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "009_must_change_password.sql").read_text())  # must change password
    for mig in (MIGRATION_001, MIGRATION_003):
        sql = mig.read_text()
        cur.execute(sql)
        cur.execute(sql)
    cur.execute((MIGRATION_001.parent / "004_share_pair_guard.sql").read_text())  # DB-level guard on too
    h = hash_password(PW)
    for u, role, pol, con, dist, mla in [
        ("admin", "admin", "Admin", "All", "All", None),
        ("mla_a", "mla", "MLA A", "Sircilla", "Rajanna", None),
        ("mla_b", "mla", "MLA B", "Mulugu", "Mulugu", None),
        ("staff_a1", "staff", "", "", "", "mla_a"),
        ("staff_a2", "staff", "", "", "", "mla_a"),
    ]:
        cur.execute(
            "INSERT INTO users (username,password_hash,role,politician_name,constituency_name,"
            "district_name,mla_username) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (u, h, role, pol, con, dist, mla))
    conn.commit(); cur.close(); conn.close()
    from app.main import app
    return TestClient(app)


@pytest.fixture(autouse=True)
def _clean():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM device_tokens")
    cur.execute("DELETE FROM share_recipients")
    cur.execute("DELETE FROM shares")
    conn.commit(); cur.close(); conn.close()


def login(c, user):
    r = c.post("/api/login", json={"username": user, "password": PW}).json()
    assert r["status"] == "success", r
    return {"Authorization": f"Bearer {r['token']}"}


def reg_token(c, headers, token):
    r = c.post("/api/devices", headers=headers, json={"token": token})
    assert r.status_code == 200, r.text


def test_push_sent_for_each_recipient(client, monkeypatch):
    a = login(client, "mla_a")
    ma = login(client, "staff_a1")
    mb = login(client, "staff_a2")
    reg_token(client, ma, "ExponentPushToken[ta]")
    reg_token(client, mb, "ExponentPushToken[tb]")

    calls = []

    def fake_post(url, json=None, timeout=None):
        calls.append((url, json))
        resp = type("R", (), {})()
        resp.status_code = 200
        resp.raise_for_status = lambda: None
        resp.json = lambda: {"data": [{"status": "ok"} for _ in (json or [])]}
        return resp

    monkeypatch.setattr("app.services.push_service.httpx.post", fake_post)

    r = client.post("/api/shares", headers=a, json={
        "title": "Road collapse", "priority": "urgent", "recipients": ["staff_a1", "staff_a2"],
    })
    assert r.status_code == 200
    sid = r.json()["share_id"]

    assert len(calls) == 1
    url, msgs = calls[0]
    assert "exp.host" in url
    tos = [m["to"] for m in msgs]
    assert "ExponentPushToken[ta]" in tos
    assert "ExponentPushToken[tb]" in tos
    for m in msgs:
        assert m["title"] == "mla_a"
        assert m["body"] == "Road collapse"
        assert m["data"] == {"share_id": sid}
        assert m["priority"] == "high"


def test_no_push_to_sender(client, monkeypatch):
    a = login(client, "mla_a")
    ma = login(client, "staff_a1")
    reg_token(client, a, "ExponentPushToken[sender]")
    reg_token(client, ma, "ExponentPushToken[ta]")

    calls = []

    def fake_post(url, json=None, timeout=None):
        calls.append(json)
        resp = type("R", (), {})()
        resp.status_code = 200
        resp.raise_for_status = lambda: None
        resp.json = lambda: {"data": [{"status": "ok"} for _ in (json or [])]}
        return resp

    monkeypatch.setattr("app.services.push_service.httpx.post", fake_post)

    r = client.post("/api/shares", headers=a, json={
        "title": "Hello", "recipients": ["staff_a1"],
    })
    assert r.status_code == 200
    assert len(calls) == 1
    tos = [m["to"] for m in calls[0]]
    assert "ExponentPushToken[sender]" not in tos
    assert "ExponentPushToken[ta]" in tos


def test_share_succeeds_when_push_fails(client, monkeypatch):
    a = login(client, "mla_a")
    ma = login(client, "staff_a1")
    reg_token(client, ma, "ExponentPushToken[ta]")

    def boom(url, json=None, timeout=None):
        raise RuntimeError("network down")

    monkeypatch.setattr("app.services.push_service.httpx.post", boom)

    r = client.post("/api/shares", headers=a, json={
        "title": "Hello", "recipients": ["staff_a1"],
    })
    assert r.status_code == 200
    assert r.json()["recipient_count"] == 1


def test_device_not_registered_removed(client, monkeypatch):
    a = login(client, "mla_a")
    ma = login(client, "staff_a1")
    reg_token(client, ma, "ExponentPushToken[ta]")

    calls = []

    def fake_post(url, json=None, timeout=None):
        calls.append(json)
        resp = type("R", (), {})()
        resp.status_code = 200
        resp.raise_for_status = lambda: None
        resp.json = lambda: {"data": [{"status": "error", "details": {"error": "DeviceNotRegistered"}} for _ in (json or [])]}
        return resp

    monkeypatch.setattr("app.services.push_service.httpx.post", fake_post)

    r = client.post("/api/shares", headers=a, json={
        "title": "Hello", "recipients": ["staff_a1"],
    })
    assert r.status_code == 200

    # token should be removed
    from app.core.database import get_connection
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM device_tokens WHERE token = %s", ("ExponentPushToken[ta]",))
    assert cur.fetchone()[0] == 0
    cur.close()
    conn.close()
