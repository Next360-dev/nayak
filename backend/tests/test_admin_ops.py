"""
Admin password reset, health check and security headers (needs a throwaway Postgres; see test_shares.py).
"""
import os
import pathlib

import pytest

if not os.getenv("ASO_TEST_DB"):
    pytest.skip("set ASO_TEST_DB=1 and DB_* to a throwaway database", allow_module_level=True)

from fastapi.testclient import TestClient

from app.core.database import get_connection
from app.core.security import hash_password

MIGRATION = pathlib.Path(__file__).parents[1] / "migrations" / "001_auth_and_shares.sql"
MIGRATION_MOBILE = pathlib.Path(__file__).parents[1] / "migrations" / "003_mobile.sql"
PW = "correct-horse-1"
NEW_PW = "brand-new-pass-2"

BASE_USERS = """
DROP TABLE IF EXISTS team_task_notes, team_tasks, briefing_edits, story_feedback, app_feedback, notification_log, audit_log, refresh_tokens, device_tokens, share_replies, share_recipients, shares, users CASCADE;
CREATE TABLE users (
  username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, role TEXT NOT NULL,
  politician_name TEXT, constituency_name TEXT, district_name TEXT, last_login TIMESTAMPTZ
);
"""


@pytest.fixture(scope="module")
def client():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(BASE_USERS)
    cur.execute(MIGRATION.read_text())
    cur.execute(MIGRATION_MOBILE.read_text())
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "005_audit_and_password_age.sql").read_text())  # password age + audit log
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "006_alerts_feedback.sql").read_text())  # contacts + alerts
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "007_team_board.sql").read_text())  # team board
    h = hash_password(PW)
    for u, role in [("admin", "admin"), ("mla_a", "mla")]:
        cur.execute(
            "INSERT INTO users (username,password_hash,role,politician_name,constituency_name,district_name) "
            "VALUES (%s,%s,%s,%s,%s,%s)", (u, h, role, u, "Sircilla", "Rajanna"))
    conn.commit(); cur.close(); conn.close()
    from app.main import app
    return TestClient(app)


def login(c, user, pw=PW):
    return c.post("/api/login", json={"username": user, "password": pw}).json()


def auth(c, user):
    r = login(c, user)
    assert r["status"] == "success", r
    return {"Authorization": f"Bearer {r['token']}"}


def test_reset_requires_admin(client):
    body = {"username": "mla_a", "new_password": NEW_PW}
    assert client.post("/api/users/reset-password", json=body).status_code == 401
    assert client.post("/api/users/reset-password", json=body, headers=auth(client, "mla_a")).status_code == 403


def test_reset_validates_input(client):
    h = auth(client, "admin")
    short = client.post("/api/users/reset-password", json={"username": "mla_a", "new_password": "short"}, headers=h)
    assert short.status_code == 422
    missing = client.post("/api/users/reset-password", json={"username": "nobody", "new_password": NEW_PW}, headers=h)
    assert missing.status_code == 404


def test_reset_changes_password(client):
    h = auth(client, "admin")
    r = client.post("/api/users/reset-password", json={"username": "MLA_A", "new_password": NEW_PW}, headers=h)
    assert r.status_code == 200 and r.json()["status"] == "success"
    assert login(client, "mla_a", PW)["status"] != "success"
    assert login(client, "mla_a", NEW_PW)["status"] == "success"


def test_health_and_security_headers(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json() == {"status": "ok", "database": "up"}
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
