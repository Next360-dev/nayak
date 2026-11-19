"""
End-to-end tests for auth + sharing against a real PostgreSQL.

Run against a THROWAWAY database only (it creates/drops the users and share tables):
  docker run -d --rm --name aso-test-pg -e POSTGRES_PASSWORD=testpass -e POSTGRES_DB=aso_test \
      -p 127.0.0.1:55432:5432 postgres:16-alpine
  ASO_TEST_DB=1 DB_HOST=127.0.0.1 DB_PORT=55432 DB_NAME=aso_test DB_USER=postgres \
      DB_PASSWORD=testpass JWT_SECRET=test pytest backend/tests -q
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
PW = "correct-horse-1"

BASE_USERS = """
DROP TABLE IF EXISTS team_task_notes, team_tasks, briefing_edits, share_replies, share_recipients, shares, users CASCADE;
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
    sql = MIGRATION.read_text()
    cur.execute(sql)
    cur.execute(sql)  # migration must be safe to run twice
    cur.execute((MIGRATION.parent / "004_share_pair_guard.sql").read_text())  # DB-level guard on too
    h = hash_password(PW)
    for u, role, pol, con, dist, mla in [
        ("admin", "admin", "Admin", "All", "All", None),
        ("mla_a", "mla", "MLA A", "Sircilla", "Rajanna", None),
        ("mla_b", "mla", "MLA B", "Mulugu", "Mulugu", None),
        ("staff_a", "staff", "", "", "", "mla_a"),
        ("min_x", "minister", "Min X", "Gajwel", "Siddipet", None),
    ]:
        cur.execute(
            "INSERT INTO users (username,password_hash,role,politician_name,constituency_name,"
            "district_name,mla_username) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (u, h, role, pol, con, dist, mla))
    conn.commit(); cur.close(); conn.close()
    from app.main import app
    return TestClient(app)


def login(c, user, pw=PW):
    r = c.post("/api/login", json={"username": user, "password": pw}).json()
    assert r["status"] == "success", r
    return {"Authorization": f"Bearer {r['token']}"}


ART = {"title": "Road collapse in Sircilla", "url": "http://x/1", "priority": "urgent"}


def test_auth_required_and_headers_ignored(client):
    assert client.get("/api/shares/inbox").status_code == 401
    r = client.get("/api/shares/inbox", headers={"X-User-Role": "admin"})
    assert r.status_code == 401


def test_bad_login_and_lockout(client):
    assert client.post("/api/login", json={"username": "mla_a", "password": "nope"}).json()["status"] == "error"
    for _ in range(6):
        client.post("/api/login", json={"username": "lock_me", "password": "x"})
    assert client.post("/api/login", json={"username": "lock_me", "password": "x"}).status_code == 429


def test_staff_shares_to_leader_status_and_reply_flow(client):
    st, m, b = login(client, "staff_a"), login(client, "mla_a"), login(client, "mla_b")
    r = client.post("/api/shares", headers=st, json={**ART, "recipients": ["mla_a"], "note": "please act"})
    assert r.status_code == 200 and r.json()["recipient_count"] == 1
    sid = r.json()["share_id"]

    inbox = client.get("/api/shares/inbox", headers=m).json()["shares"]
    assert len(inbox) == 1 and inbox[0]["status"] == "new" and inbox[0]["sender"] == "staff_a"
    assert client.get("/api/shares/unread-count", headers=m).json()["count"] == 1

    assert client.patch(f"/api/shares/{sid}/status", headers=m, json={"status": "acting"}).status_code == 200
    assert client.get("/api/shares/unread-count", headers=m).json()["count"] == 0

    assert client.post(f"/api/shares/{sid}/replies", headers=m, json={"body": "On it"}).status_code == 200
    # the sender must name the recipient thread, then can reply
    assert client.post(f"/api/shares/{sid}/replies", headers=st, json={"body": "ok"}).status_code == 422
    assert client.post(f"/api/shares/{sid}/replies", headers=st,
                       json={"body": "thanks", "recipient": "mla_a"}).status_code == 200
    thread = client.get(f"/api/shares/{sid}/replies", headers=m).json()["replies"]
    assert [x["body"] for x in thread] == ["On it", "thanks"]

    # another MLA never sees this thread; the staff member sees status in Sent
    assert client.get(f"/api/shares/{sid}/replies", headers=b).status_code == 404
    sent = client.get("/api/shares/sent", headers=st).json()["shares"]
    assert sent[0]["recipients"][0]["recipient"] == "mla_a" and sent[0]["recipients"][0]["status"] == "acting"
    # staff do NOT read their leader's inbox any more
    assert client.get("/api/shares/inbox", headers=st).json()["shares"] == []


def test_leader_shares_down_to_own_staff(client):
    m, st = login(client, "mla_a"), login(client, "staff_a")
    assert client.get("/api/shares/targets", headers=m).json()["targets"][0]["username"] == "staff_a"
    r = client.post("/api/shares", headers=m, json={**ART, "title": "From the MLA", "recipients": ["staff_a"]})
    assert r.status_code == 200
    got = client.get("/api/shares/inbox", headers=st).json()["shares"]
    assert [x["title"] for x in got] == ["From the MLA"] and got[0]["sender"] == "mla_a"


def test_targets_and_boundaries(client):
    st, m = login(client, "staff_a"), login(client, "mla_a")
    assert [t["username"] for t in client.get("/api/shares/targets", headers=st).json()["targets"]] == ["mla_a"]
    # staff: only their own leader
    for who in (["mla_b"], ["min_x"], ["admin"], ["staff_a"]):
        assert client.post("/api/shares", headers=st, json={**ART, "recipients": who}).status_code in (403, 422), who
    # leader: not another leader, not the admin, not somebody else's staff
    cu = client.post("/api/users/create", headers=login(client, "admin"), json={
        "username": "staff_b", "password": PW, "role": "staff", "mla_username": "mla_b"})
    assert cu.status_code == 200
    for who in (["mla_b"], ["admin"], ["staff_b"]):
        assert client.post("/api/shares", headers=m, json={**ART, "recipients": who}).status_code == 403, who
    # no broadcast for anyone, no empty shares
    assert client.post("/api/shares", headers=m, json={**ART, "all_mlas": True}).status_code == 403
    assert client.post("/api/shares", headers=st, json={**ART, "district": "Rajanna"}).status_code == 403
    assert client.post("/api/shares", headers=st, json={**ART, "recipients": []}).status_code == 422
    # cannot touch a share that isn't yours
    b = login(client, "mla_b")
    assert client.patch("/api/shares/999999/status", headers=b, json={"status": "done"}).status_code == 404
    assert client.get("/api/shares/999999/replies", headers=b).status_code == 404


def test_disabled_staff_is_not_a_target(client):
    m = login(client, "mla_a")
    client.post("/api/team/set-active", headers=m, json={"username": "staff_a", "active": False})
    assert client.get("/api/shares/targets", headers=m).json()["targets"] == []
    assert client.post("/api/shares", headers=m, json={**ART, "recipients": ["staff_a"]}).status_code == 403
    client.post("/api/team/set-active", headers=m, json={"username": "staff_a", "active": True})


def test_admin_is_read_only_but_sees_everything(client):
    a, st, m = login(client, "admin"), login(client, "staff_a"), login(client, "mla_a")
    sid = client.post("/api/shares", headers=st, json={**ART, "recipients": ["mla_a"]}).json()["share_id"]
    client.post(f"/api/shares/{sid}/replies", headers=m, json={"body": "private-ish reply"})
    # cannot share, reply or change status
    assert client.post("/api/shares", headers=a, json={**ART, "recipients": ["mla_a"]}).status_code == 403
    assert client.post(f"/api/shares/{sid}/replies", headers=a, json={"body": "x", "recipient": "mla_a"}).status_code == 403
    assert client.patch(f"/api/shares/{sid}/status", headers=a, json={"status": "done"}).status_code == 403
    # has nothing to share to and an empty own inbox, but reads every share and thread
    assert client.get("/api/shares/targets", headers=a).json()["targets"] == []
    assert client.get("/api/shares/inbox", headers=a).json()["shares"] == []
    sent = client.get("/api/shares/sent", headers=a).json()["shares"]
    assert any(x["id"] == sid and x["sender"] == "staff_a" for x in sent)
    thread = client.get(f"/api/shares/{sid}/replies?recipient=mla_a", headers=a).json()["replies"]
    assert [x["body"] for x in thread] == ["private-ish reply"]
    me = client.get("/api/me", headers=a).json()["user"]
    assert me["can_share"] is False and me["can_share_to_anyone"] is False


def test_admin_support_user_list_and_disable(client):
    a, m = login(client, "admin"), login(client, "mla_a")
    users = client.get("/api/users", headers=a).json()["users"]
    by = {u["username"]: u for u in users}
    assert {"admin", "mla_a", "mla_b", "staff_a", "min_x"} <= set(by)
    assert by["staff_a"]["works_for"] == "mla_a" and by["staff_a"]["constituency_name"] == "Sircilla"
    assert "password_hash" not in str(users)
    assert client.get("/api/users", headers=m).status_code == 403
    # disable / enable
    assert client.post("/api/users/set-active", headers=a, json={"username": "mla_b", "active": False}).status_code == 200
    assert client.post("/api/login", json={"username": "mla_b", "password": PW}).json()["status"] != "success"
    assert {u["username"]: u["is_active"] for u in client.get("/api/users", headers=a).json()["users"]}["mla_b"] is False
    assert client.post("/api/users/set-active", headers=a, json={"username": "mla_b", "active": True}).status_code == 200
    assert client.post("/api/login", json={"username": "mla_b", "password": PW}).json()["status"] == "success"
    # guard rails
    assert client.post("/api/users/set-active", headers=a, json={"username": "admin", "active": False}).status_code == 403
    assert client.post("/api/users/set-active", headers=a, json={"username": "nobody", "active": False}).status_code == 404
    assert client.post("/api/users/set-active", headers=m, json={"username": "staff_a", "active": False}).status_code == 403
    # admin can still create users; others cannot
    assert client.post("/api/users/create", headers=m, json={"username": "z", "password": PW}).status_code == 403
