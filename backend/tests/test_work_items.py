"""
Work items (letters & petitions with approval) against a real throwaway PostgreSQL.
Run like test_shares.py:
  docker run -d --rm --name aso-test-pg -e POSTGRES_PASSWORD=testpass -e POSTGRES_DB=aso_test \
      -p 127.0.0.1:55432:5432 postgres:16-alpine
  ASO_TEST_DB=1 DB_HOST=127.0.0.1 DB_PORT=55432 DB_NAME=aso_test DB_USER=postgres \
      DB_PASSWORD=testpass JWT_SECRET=test pytest backend/tests/test_work_items.py -q
"""
import json
import os
import pathlib

import pytest

if not os.getenv("ASO_TEST_DB"):
    pytest.skip("set ASO_TEST_DB=1 and DB_* to a throwaway database", allow_module_level=True)

import psycopg2
from fastapi.testclient import TestClient

from app.core.database import get_connection
from app.core.security import hash_password

MIG = pathlib.Path(__file__).parents[1] / "migrations"
PW = "correct-horse-1"

DROP = ("team_task_notes, team_tasks, briefing_edits, work_item_events, work_items, "
        "share_replies, share_recipients, shares, users CASCADE")


@pytest.fixture(scope="module")
def client():
    conn = get_connection(); cur = conn.cursor()
    cur.execute(f"DROP TABLE IF EXISTS {DROP}")
    c = conn; c.commit()
    cur.execute((MIG / "000_base_schema.sql").read_text())
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "005_audit_and_password_age.sql").read_text())
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "006_alerts_feedback.sql").read_text())
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "007_team_board.sql").read_text())
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "008_leader_title.sql").read_text())
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "009_must_change_password.sql").read_text())
    for f in ("001_auth_and_shares.sql", "003_mobile.sql", "004_share_pair_guard.sql"):
        cur.execute((MIG / f).read_text())
    cur.execute((MIG / "010_work_items.sql").read_text())           # the new migration (safe twice)
    cur.execute((MIG / "010_work_items.sql").read_text())           # idempotent
    h = hash_password(PW)
    for u, role, pol, con, dist, boss in [
        ("admin", "admin", "Admin", "All", "All", None),
        ("mla_s", "mla", "MLA S", "Sircilla", "Rajanna Sircilla", None),
        ("min_x", "minister", "Min X", "Gajwel", "Siddipet", None),
        ("staff_s", "staff", "", "", "", "mla_s"),
        ("staff_s2", "staff", "", "", "", "mla_s"),
        ("staff_m", "staff", "", "", "", "min_x"),
    ]:
        cur.execute("INSERT INTO users (username,password_hash,role,politician_name,constituency_name,district_name,mla_username)"
                    " VALUES (%s,%s,%s,%s,%s,%s,%s)", (u, h, role, pol, con, dist, boss))
    conn.commit(); cur.close(); conn.close()
    from app.main import app
    return TestClient(app)


def hdr(c, u):
    r = c.post("/api/login", json={"username": u, "password": PW}).json()
    assert r["status"] == "success", r
    return {"Authorization": f"Bearer {r['token']}"}


def new_item(c, who="staff_s", **kw):
    body = {"kind": "letter", "direction": "incoming", "title": "Petition about water supply", **kw}
    r = c.post("/api/work-items", headers=hdr(c, who), json=body)
    assert r.status_code == 200, r.text
    return r.json()["item"]


def test_admin_has_no_item_access(client):
    a = hdr(client, "admin")
    assert client.get("/api/work-items", headers=a).status_code == 404
    assert client.post("/api/work-items", headers=a, json={"kind": "letter", "direction": "incoming", "title": "x"}).status_code == 404
    assert client.get("/api/work-items/1", headers=a).status_code == 404


def test_staff_create_list_and_get(client):
    t = new_item(client, counterpart="Rural Water Dept", priority="urgent")
    assert t["status"] == "draft" and t["created_by"] == "staff_s" and t["counterpart"] == "Rural Water Dept"
    assert t["creator_name"] == "staff_s" and t["leader_name"] == "MLA S" and t["assignee_name"] is None
    r = client.get("/api/work-items", headers=hdr(client, "staff_s"))
    assert r.status_code == 200 and r.json()["total"] >= 1 and any(i["id"] == t["id"] for i in r.json()["items"])
    g = client.get(f"/api/work-items/{t['id']}", headers=hdr(client, "staff_s"))
    assert g.status_code == 200
    assert g.json()["item"]["id"] == t["id"] and g.json()["can"]["edit"] is True
    assert g.json()["can"]["decide"] is False          # staff can never decide
    assert len(g.json()["events"]) >= 1 and g.json()["events"][0]["action"] == "created"


def test_every_legal_transition(client):
    mla = hdr(client, "mla_s"); staff = hdr(client, "staff_s")
    # draft -> submit -> approve -> close
    t = new_item(client)
    r = client.post(f"/api/work-items/{t['id']}/submit", headers=staff, json={})
    assert r.status_code == 200 and r.json()["item"]["status"] == "submitted"
    assert client.get(f"/api/work-items/{t['id']}", headers=mla).json()["can"]["decide"] is True
    r = client.post(f"/api/work-items/{t['id']}/decide", headers=mla, json={"decision": "approve", "note": "Looks good"})
    assert r.status_code == 200 and r.json()["item"]["status"] == "approved"
    r = client.post(f"/api/work-items/{t['id']}/close", headers=staff, json={"note": "done"})
    assert r.status_code == 200 and r.json()["item"]["status"] == "closed"

    # draft -> submit -> reject -> close
    t = new_item(client)
    client.post(f"/api/work-items/{t['id']}/submit", headers=staff, json={})
    r = client.post(f"/api/work-items/{t['id']}/decide", headers=mla, json={"decision": "reject", "note": "Needs work"})
    assert r.status_code == 200 and r.json()["item"]["status"] == "rejected"
    client.post(f"/api/work-items/{t['id']}/close", headers=mla, json={})
    assert client.get(f"/api/work-items/{t['id']}", headers=mla).json()["item"]["status"] == "closed"

    # draft -> submit -> changes_requested -> submit -> approve -> close
    t = new_item(client)
    client.post(f"/api/work-items/{t['id']}/submit", headers=staff, json={})
    r = client.post(f"/api/work-items/{t['id']}/decide", headers=mla, json={"decision": "changes", "note": "Fix title"})
    assert r.status_code == 200 and r.json()["item"]["status"] == "changes_requested"
    r = client.patch(f"/api/work-items/{t['id']}", headers=staff, json={"title": "Fixed title"})
    assert r.status_code == 200 and r.json()["item"]["title"] == "Fixed title"
    client.post(f"/api/work-items/{t['id']}/submit", headers=staff, json={})
    client.post(f"/api/work-items/{t['id']}/decide", headers=mla, json={"decision": "approve", "note": "OK now"})
    client.post(f"/api/work-items/{t['id']}/close", headers=staff, json={})
    assert client.get(f"/api/work-items/{t['id']}", headers=mla).json()["item"]["status"] == "closed"


def test_every_illegal_transition_returns_409(client):
    staff = hdr(client, "staff_s"); mla = hdr(client, "mla_s")
    t = new_item(client)                                   # draft
    cases = [
        ("/decide", {"decision": "approve", "note": "x"}),                  # draft -> approved illegal
        ("/submit", {}),                                                    # submitted->submitted via submit (no-op path)
    ]
    r = client.post(f"/api/work-items/{t['id']}/decide", headers=mla, json={"decision": "approve", "note": "x"})
    assert r.status_code == 409 and "draft" in r.json()["detail"], r.text

    client.post(f"/api/work-items/{t['id']}/submit", headers=staff, json={})   # now submitted
    r = client.post(f"/api/work-items/{t['id']}/decide", headers=mla, json={"decision": "approve", "note": "x"})
    assert r.status_code == 200                                             # submitted->approve legal
    r = client.post(f"/api/work-items/{t['id']}/decide", headers=mla, json={"decision": "reject", "note": "x"})
    assert r.status_code == 409 and "approved" in r.json()["detail"], r.text  # approved->rejected illegal

    t2 = new_item(client)
    client.post(f"/api/work-items/{t2['id']}/submit", headers=staff, json={})
    client.post(f"/api/work-items/{t2['id']}/decide", headers=mla, json={"decision": "reject", "note": "no"})
    r = client.post(f"/api/work-items/{t2['id']}/decide", headers=mla, json={"decision": "approve", "note": "x"})
    assert r.status_code == 409 and "rejected" in r.json()["detail"], r.text  # rejected->approved illegal


def test_db_trigger_refuses_illegal_transition(client):
    staff = hdr(client, "staff_s")
    t = new_item(client)
    conn = get_connection()
    try:
        cur = conn.cursor()
        with pytest.raises(psycopg2.errors.CheckViolation):
            cur.execute("UPDATE work_items SET status = 'approved' WHERE id = %s", (t["id"],))
        conn.rollback()
    finally:
        conn.close()


def test_staff_cannot_decide(client):
    staff = hdr(client, "staff_s"); mla = hdr(client, "mla_s")
    t = new_item(client)
    client.post(f"/api/work-items/{t['id']}/submit", headers=staff, json={})
    assert client.post(f"/api/work-items/{t['id']}/decide", headers=staff, json={"decision": "approve", "note": "x"}).status_code == 403


def test_admin_decide_is_404(client):
    t = new_item(client)
    assert client.post(f"/api/work-items/{t['id']}/decide", headers=hdr(client, "admin"), json={"decision": "approve", "note": "x"}).status_code == 404


def test_another_team_gets_404(client):
    staff_m = hdr(client, "staff_m"); staff_s = hdr(client, "staff_s")
    t = new_item(client, who="staff_s")
    assert client.get(f"/api/work-items/{t['id']}", headers=staff_m).status_code == 404
    assert client.post(f"/api/work-items/{t['id']}/decide", headers=staff_m, json={"decision": "approve", "note": "x"}).status_code == 404
    board = client.get("/api/work-items", headers=staff_m).json()
    assert all(i["id"] != t["id"] for i in board["items"])


def test_leader_cannot_edit_while_submitted(client):
    staff = hdr(client, "staff_s"); mla = hdr(client, "mla_s")
    t = new_item(client)
    client.post(f"/api/work-items/{t['id']}/submit", headers=staff, json={})
    assert client.patch(f"/api/work-items/{t['id']}", headers=mla, json={"title": "nope"}).status_code == 409
    assert client.get(f"/api/work-items/{t['id']}", headers=mla).json()["can"]["edit"] is False


def test_reject_and_changes_require_a_note(client):
    staff = hdr(client, "staff_s"); mla = hdr(client, "mla_s")
    t = new_item(client)
    client.post(f"/api/work-items/{t['id']}/submit", headers=staff, json={})
    assert client.post(f"/api/work-items/{t['id']}/decide", headers=mla, json={"decision": "reject"}).status_code == 422
    assert client.post(f"/api/work-items/{t['id']}/decide", headers=mla, json={"decision": "changes", "note": ""}).status_code == 422
    assert client.post(f"/api/work-items/{t['id']}/decide", headers=mla, json={"decision": "changes", "note": "fix it"}).status_code == 200


def test_events_are_append_only(client):
    t = new_item(client)
    client.post(f"/api/work-items/{t['id']}/comments", headers=hdr(client, "staff_s"), json={"body": "hello"})
    conn = get_connection()
    try:
        cur = conn.cursor()
        for sql, args in [
            ("UPDATE work_item_events SET note = 'x' WHERE item_id = %s", (t["id"],)),
            ("DELETE FROM work_item_events WHERE item_id = %s", (t["id"],)),
        ]:
            with pytest.raises(psycopg2.errors.CheckViolation):
                cur.execute(sql, args)
            conn.rollback()
    finally:
        conn.close()


def test_pending_count(client):
    staff = hdr(client, "staff_s"); mla = hdr(client, "mla_s"); staff_m = hdr(client, "staff_m")
    t = new_item(client)
    client.post(f"/api/work-items/{t['id']}/submit", headers=staff, json={})
    assert client.get("/api/work-items/pending-count", headers=mla).json()["count"] >= 1
    assert client.get("/api/work-items/pending-count", headers=staff).json()["count"] == 0
    assert client.get("/api/work-items/pending-count", headers=staff_m).json()["count"] == 0


def test_push_failure_does_not_fail_submit(client, monkeypatch):
    from app.services import push_service
    monkeypatch.setattr(push_service, "send_work_item_push", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("expo down")))
    staff = hdr(client, "staff_s")
    t = new_item(client)
    assert client.post(f"/api/work-items/{t['id']}/submit", headers=staff, json={}).status_code == 200


def test_push_payload_work_item_id_not_share_id(client, monkeypatch):
    from app.services import push_service, notify_service
    captured = {}
    monkeypatch.setattr(push_service, "send_work_item_push",
                        lambda sender, title, item_id, recipients: captured.update(
                            sender=sender, title=title, item_id=item_id, recipients=recipients))
    monkeypatch.setattr(notify_service, "deliver", lambda *a, **k: "skipped")
    staff = hdr(client, "staff_s")
    t = new_item(client)
    client.post(f"/api/work-items/{t['id']}/submit", headers=staff, json={"note": "please review"})
    assert captured["item_id"] == t["id"]
    assert captured["sender"] == "staff_s"
    assert captured["recipients"] == ["mla_s"]


def test_list_filter_by_status(client):
    staff = hdr(client, "staff_s")
    t1 = new_item(client, title="draft one")
    t2 = new_item(client, title="draft two")
    client.post(f"/api/work-items/{t1['id']}/submit", headers=staff, json={})
    r = client.get("/api/work-items?status=draft", headers=staff).json()
    assert all(i["status"] == "draft" for i in r["items"]) and any(i["id"] == t2["id"] for i in r["items"])
    r = client.get("/api/work-items?status=submitted", headers=staff).json()
    assert any(i["id"] == t1["id"] for i in r["items"])


def test_list_filter_by_kind(client):
    staff = hdr(client, "staff_s")
    new_item(client, kind="letter", title="letter one")
    new_item(client, kind="petition", title="petition one")
    r = client.get("/api/work-items?kind=petition", headers=staff).json()
    assert all(i["kind"] == "petition" for i in r["items"]) and any(i["title"] == "petition one" for i in r["items"])


def test_list_filter_mine(client):
    staff = hdr(client, "staff_s")
    mine = new_item(client)
    not_mine = new_item(client, who="staff_s2")
    r = client.get("/api/work-items?mine=1", headers=staff).json()
    assert any(i["id"] == mine["id"] for i in r["items"])
    assert not any(i["id"] == not_mine["id"] for i in r["items"])


def test_list_limit_offset(client):
    staff = hdr(client, "staff_s")
    for n in range(5):
        new_item(client, title=f"offset item {n}")
    r1 = client.get("/api/work-items?limit=2&offset=0", headers=staff).json()
    r2 = client.get("/api/work-items?limit=2&offset=2", headers=staff).json()
    ids1 = {i["id"] for i in r1["items"]}
    ids2 = {i["id"] for i in r2["items"]}
    assert len(r1["items"]) == 2 and len(r2["items"]) == 2 and ids1.isdisjoint(ids2)


def test_comment_empty_returns_422(client):
    staff = hdr(client, "staff_s")
    t = new_item(client)
    assert client.post(f"/api/work-items/{t['id']}/comments", headers=staff, json={"body": "   "}).status_code == 422


def test_comment_over_2000_returns_422(client):
    staff = hdr(client, "staff_s")
    t = new_item(client)
    assert client.post(f"/api/work-items/{t['id']}/comments", headers=staff,
                       json={"body": "x" * 2001}).status_code == 422


def test_close_from_non_final_409(client):
    staff = hdr(client, "staff_s")
    t = new_item(client)
    assert client.post(f"/api/work-items/{t['id']}/close", headers=staff, json={}).status_code == 409
    client.post(f"/api/work-items/{t['id']}/submit", headers=staff, json={})
    assert client.post(f"/api/work-items/{t['id']}/close", headers=staff, json={}).status_code == 409


def test_edit_works_after_changes_requested(client):
    staff = hdr(client, "staff_s"); mla = hdr(client, "mla_s")
    t = new_item(client)
    client.post(f"/api/work-items/{t['id']}/submit", headers=staff, json={})
    client.post(f"/api/work-items/{t['id']}/decide", headers=mla, json={"decision": "changes", "note": "fix it"})
    r = client.patch(f"/api/work-items/{t['id']}", headers=staff, json={"title": "edited after changes"})
    assert r.status_code == 200 and r.json()["item"]["title"] == "edited after changes"
    client.post(f"/api/work-items/{t['id']}/submit", headers=staff, json={})
    assert client.get(f"/api/work-items/{t['id']}", headers=mla).json()["can"]["edit"] is False


def test_assignee_change_records_assigned_event(client):
    staff = hdr(client, "staff_s")
    t = new_item(client)                                     # no assignee yet
    events = client.get(f"/api/work-items/{t['id']}", headers=staff).json()["events"]
    assert not any(e["action"] == "assigned" for e in events)
    r = client.patch(f"/api/work-items/{t['id']}", headers=staff, json={"assignee": "staff_s2"})
    assert r.status_code == 200
    events = client.get(f"/api/work-items/{t['id']}", headers=staff).json()["events"]
    assigned = [e for e in events if e["action"] == "assigned"]
    assert any("staff_s2" in (e.get("note") or "") for e in assigned)
    r = client.patch(f"/api/work-items/{t['id']}", headers=staff, json={"assignee": "mla_s"})
    assert r.status_code == 200
    events = client.get(f"/api/work-items/{t['id']}", headers=staff).json()["events"]
    assigned = [e for e in events if e["action"] == "assigned"]
    assert any("mla_s" in (e.get("note") or "") for e in assigned)


def test_create_invalid_kind_422(client):
    staff = hdr(client, "staff_s")
    assert client.post("/api/work-items", headers=staff,
                       json={"kind": "memo", "direction": "incoming", "title": "x"}).status_code == 422


def test_close_then_decide_409(client):
    staff = hdr(client, "staff_s"); mla = hdr(client, "mla_s")
    t = new_item(client)
    client.post(f"/api/work-items/{t['id']}/submit", headers=staff, json={})
    client.post(f"/api/work-items/{t['id']}/decide", headers=mla, json={"decision": "approve", "note": "ok"})
    client.post(f"/api/work-items/{t['id']}/close", headers=staff, json={})
    assert client.post(f"/api/work-items/{t['id']}/decide", headers=mla, json={"decision": "reject", "note": "no"}).status_code == 409
