import os
import pathlib

import pytest

if not os.getenv("ASO_TEST_DB"):
    pytest.skip("set ASO_TEST_DB=1 and DB_* to a throwaway database", allow_module_level=True)

from fastapi.testclient import TestClient

from app.core.database import get_connection
from app.core.security import hash_password


@pytest.fixture(autouse=True)
def _clean_device_tokens():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM device_tokens")
    conn.commit()
    cur.close()
    conn.close()

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
    for uname in ("mla_a", "mla_b"):
        cur.execute(
            "INSERT INTO users (username,password_hash,role,politician_name,constituency_name,district_name) "
            "VALUES (%s,%s,%s,%s,%s,%s)",
            (uname, h, "mla", uname.upper(), "Sircilla", "Rajanna"),
        )
    conn.commit()
    cur.close()
    conn.close()
    from app.main import app
    return TestClient(app)


def _login(c, username):
    r = c.post("/api/login", json={"username": username, "password": PW})
    assert r.status_code == 200
    return r.json()["token"]


def test_register_valid_token(client):
    tok = _login(client, "mla_a")
    h = {"Authorization": f"Bearer {tok}"}
    r = client.post("/api/devices", headers=h, json={"token": "ExponentPushToken[abc123]", "platform": "android"})
    assert r.status_code == 200
    assert r.json()["status"] == "success"


def test_invalid_token_format_rejected(client):
    tok = _login(client, "mla_a")
    h = {"Authorization": f"Bearer {tok}"}
    r = client.post("/api/devices", headers=h, json={"token": "not-a-token"})
    assert r.status_code == 422


def test_duplicate_registration_idempotent(client):
    tok = _login(client, "mla_a")
    h = {"Authorization": f"Bearer {tok}"}
    t = "ExponentPushToken[dup]"
    r1 = client.post("/api/devices", headers=h, json={"token": t})
    r2 = client.post("/api/devices", headers=h, json={"token": t})
    assert r1.status_code == 200
    assert r2.status_code == 200


def test_max_five_per_user(client):
    tok = _login(client, "mla_a")
    h = {"Authorization": f"Bearer {tok}"}
    # clear any leftover
    for i in range(10):
        client.delete("/api/devices", headers=h, params={"token": f"ExponentPushToken[x{i}]"})
    for i in range(5):
        r = client.post("/api/devices", headers=h, json={"token": f"ExponentPushToken[x{i}]"})
        assert r.status_code == 200, r.text
    r = client.post("/api/devices", headers=h, json={"token": "ExponentPushToken[x5]"})
    assert r.status_code == 422


def test_other_user_cannot_delete_my_token(client):
    tok_a = _login(client, "mla_a")
    tok_b = _login(client, "mla_b")
    ha = {"Authorization": f"Bearer {tok_a}"}
    hb = {"Authorization": f"Bearer {tok_b}"}
    t = "ExponentPushToken[ownedbya]"
    client.post("/api/devices", headers=ha, json={"token": t})
    # mla_b tries to delete mla_a's token -> 404
    r = client.delete("/api/devices", headers=hb, params={"token": t})
    assert r.status_code == 404
    # token still present for mla_a
    # re-register idempotent by mla_a succeeds
    r2 = client.post("/api/devices", headers=ha, json={"token": t})
    assert r2.status_code == 200


def test_unregister_owned_token(client):
    tok = _login(client, "mla_a")
    h = {"Authorization": f"Bearer {tok}"}
    t = "ExponentPushToken[todelete]"
    client.post("/api/devices", headers=h, json={"token": t})
    r = client.delete("/api/devices", headers=h, params={"token": t})
    assert r.status_code == 200
    # deleting again -> 404
    r2 = client.delete("/api/devices", headers=h, params={"token": t})
    assert r2.status_code == 404
