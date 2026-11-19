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
  politician_name TEXT, constituency_name TEXT, district_name TEXT, last_login TIMESTAMPTZ
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
    h = hash_password(PW)
    cur.execute(
        "INSERT INTO users (username,password_hash,role,politician_name,constituency_name,district_name) "
        "VALUES (%s,%s,%s,%s,%s,%s)",
        ("mla_a", h, "mla", "MLA A", "Sircilla", "Rajanna"),
    )
    conn.commit()
    cur.close()
    conn.close()
    from app.main import app
    return TestClient(app)


def login(c, client_type=None):
    body = {"username": "mla_a", "password": PW}
    if client_type:
        body["client"] = client_type
    return c.post("/api/login", json=body)


def test_web_login_unchanged(client):
    r = login(client).json()
    assert r["status"] == "success"
    assert "refresh_token" not in r


def test_mobile_login_returns_refresh(client):
    r = login(client, "mobile").json()
    assert r["status"] == "success"
    assert r["refresh_token"]


def test_rotate_and_reuse_rejected(client):
    r = login(client, "mobile").json()
    rt = r["refresh_token"]
    r2 = client.post("/api/token/refresh", json={"refresh_token": rt}).json()
    assert r2["status"] == "success"
    assert r2["token"] and r2["refresh_token"] and r2["refresh_token"] != rt
    # reuse old token -> rejected and the whole family is revoked
    r3 = client.post("/api/token/refresh", json={"refresh_token": rt})
    assert r3.status_code == 401
    r4 = client.post("/api/token/refresh", json={"refresh_token": r2["refresh_token"]})
    assert r4.status_code == 401


def test_revoked_after_logout(client):
    r = login(client, "mobile").json()
    rt = r["refresh_token"]
    h = {"Authorization": f"Bearer {r['token']}"}
    lo = client.post("/api/logout", headers=h, json={"refresh_token": rt})
    assert lo.status_code == 200
    r2 = client.post("/api/token/refresh", json={"refresh_token": rt})
    assert r2.status_code == 401


def test_logout_all_for_user(client):
    r = login(client, "mobile").json()
    rt = r["refresh_token"]
    h = {"Authorization": f"Bearer {r['token']}"}
    client.post("/api/logout", headers=h)  # no refresh_token -> revoke all
    r2 = client.post("/api/token/refresh", json={"refresh_token": rt})
    assert r2.status_code == 401
