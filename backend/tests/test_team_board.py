"""
Team board (tasks, notes) and the staff-edited briefing (needs a throwaway Postgres; see test_shares.py).
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
    cur.execute("DROP TABLE IF EXISTS team_task_notes, team_tasks, briefing_edits, story_feedback, app_feedback, notification_log, audit_log, refresh_tokens, device_tokens, share_replies, share_recipients, shares, "
                "social_media_posts, tasks, political_representatives, new_articles, archive_news, users CASCADE")
    c.commit()
    cur.execute((MIG / "000_base_schema.sql").read_text())
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "005_audit_and_password_age.sql").read_text())  # password age + audit log
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "006_alerts_feedback.sql").read_text())  # contacts + alerts
    cur.execute((pathlib.Path(__file__).parents[1] / "migrations" / "007_team_board.sql").read_text())  # team board
    for f in ("001_auth_and_shares.sql", "003_mobile.sql", "004_share_pair_guard.sql"):
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
        ("staff_s2", "staff", "", "", "", "mla_s"),
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


def new_task(c, who="staff_s", **kw):
    body = {"title": "Check the water supply story", **kw}
    r = c.post("/api/board/tasks", headers=hdr(c, who), json=body)
    assert r.status_code == 200, r.text
    return r.json()["task"]


def test_login_and_role_walls(client):
    assert client.get("/api/board").status_code == 401
    assert client.get("/api/board", headers=hdr(client, "admin")).status_code == 403            # the control room has no team
    assert client.get("/api/team/briefing", headers=hdr(client, "mla_s")).status_code == 403    # only staff edit the briefing


def test_staff_add_assign_and_move_a_task(client):
    t = new_task(client, assigned_to="staff_s2", due_date="2030-01-02", url="https://example.org/x")
    assert t["status"] == "todo" and t["assigned_to"] == "staff_s2" and t["created_by"] == "staff_s" and t["due_date"] == "2030-01-02"
    h = hdr(client, "staff_s2")                                  # a teammate moves it
    r = client.patch(f"/api/board/tasks/{t['id']}", headers=h, json={"status": "doing"})
    assert r.status_code == 200 and r.json()["task"]["status"] == "doing"
    r = client.patch(f"/api/board/tasks/{t['id']}", headers=h, json={"assigned_to": "", "due_date": None})
    assert r.json()["task"]["assigned_to"] is None and r.json()["task"]["due_date"] is None
    assert client.patch(f"/api/board/tasks/{t['id']}", headers=h, json={"status": "bogus"}).status_code == 422


def test_task_can_only_go_to_the_same_team(client):
    h = hdr(client, "staff_s")
    for outsider in ("staff_m", "min_x", "admin", "nobody"):
        r = client.post("/api/board/tasks", headers=h, json={"title": "x", "assigned_to": outsider})
        assert r.status_code == 422, (outsider, r.text)
    assert client.post("/api/board/tasks", headers=h, json={"title": "ok", "assigned_to": "mla_s"}).status_code == 200   # the leader is in the team


def test_other_teams_never_see_or_touch_it(client):
    t = new_task(client)
    other = hdr(client, "staff_m")
    assert all(x["id"] != t["id"] for x in client.get("/api/board", headers=other).json()["tasks"])
    assert client.patch(f"/api/board/tasks/{t['id']}", headers=other, json={"status": "done"}).status_code == 404
    assert client.get(f"/api/board/tasks/{t['id']}/notes", headers=other).status_code == 404
    assert client.post(f"/api/board/tasks/{t['id']}/notes", headers=other, json={"body": "hi"}).status_code == 404
    assert client.get(f"/api/board/tasks/{t['id']}/notes", headers=hdr(client, "min_x")).status_code == 404   # another LEADER too


def test_leader_only_looks_but_can_write_a_note(client):
    t = new_task(client)
    m = hdr(client, "mla_s")
    board = client.get("/api/board", headers=m).json()
    assert board["can_manage"] is False and any(x["id"] == t["id"] for x in board["tasks"])
    assert client.post("/api/board/tasks", headers=m, json={"title": "no"}).status_code == 403
    assert client.patch(f"/api/board/tasks/{t['id']}", headers=m, json={"status": "done"}).status_code == 403
    assert client.post(f"/api/board/tasks/{t['id']}/notes", headers=m, json={"body": "Please do this first"}).status_code == 200
    client.post(f"/api/board/tasks/{t['id']}/notes", headers=hdr(client, "staff_s2"), json={"body": "On it"})
    notes = client.get(f"/api/board/tasks/{t['id']}/notes", headers=hdr(client, "staff_s")).json()["notes"]
    assert [(n["author"], n["body"]) for n in notes] == [("mla_s", "Please do this first"), ("staff_s2", "On it")]
    assert client.post(f"/api/board/tasks/{t['id']}/notes", headers=m, json={"body": ""}).status_code == 422


def test_a_disabled_staff_member_cannot_be_given_work(client):
    from app.repositories import user_repository
    user_repository.set_active("staff_s2", False)
    try:
        r = client.post("/api/board/tasks", headers=hdr(client, "staff_s"), json={"title": "x", "assigned_to": "staff_s2"})
        assert r.status_code == 422
        assert "staff_s2" not in client.get("/api/board", headers=hdr(client, "staff_s")).json()["members"]
    finally:
        user_repository.set_active("staff_s2", True)


def test_database_refuses_outsiders_even_without_the_api(client):
    import psycopg2
    t = new_task(client)
    conn = get_connection()
    try:
        for sql, args in [
            ("INSERT INTO team_tasks (team_leader, created_by, title) VALUES (%s, %s, 'x')", ("mla_s", "staff_m")),
            ("INSERT INTO team_tasks (team_leader, created_by, title, assigned_to) VALUES (%s, %s, 'x', %s)", ("mla_s", "staff_s", "staff_m")),
            ("INSERT INTO team_tasks (team_leader, created_by, title) VALUES (%s, %s, 'x')", ("staff_s", "staff_s")),     # a staff is not a team leader
            ("INSERT INTO team_task_notes (task_id, author, body) VALUES (%s, %s, 'x')", (t["id"], "staff_m")),
            ("INSERT INTO briefing_edits (team_leader, lang, for_date, body, edited_by) VALUES (%s, 'en', CURRENT_DATE, 'x', %s)", ("mla_s", "staff_m")),
        ]:
            cur = conn.cursor()
            with pytest.raises(psycopg2.errors.CheckViolation):
                cur.execute(sql, args)
            conn.rollback(); cur.close()
    finally:
        conn.close()


def test_home_screens_get_the_numbers(client):
    new_task(client, due_date="2000-01-01", assigned_to="staff_s")                 # overdue and mine
    st = client.get("/api/dashboard", headers=hdr(client, "staff_s")).json()["board"]
    ld = client.get("/api/dashboard", headers=hdr(client, "mla_s")).json()["board"]
    assert st["todo"] >= 1 and st["mine"] >= 1 and st["overdue"] >= 1
    assert (ld["todo"], ld["doing"], ld["done"]) == (st["todo"], st["doing"], st["done"])        # same team, same board
    assert client.get("/api/dashboard", headers=hdr(client, "staff_m")).json()["board"] == {"todo": 0, "doing": 0, "done": 0, "mine": 0, "overdue": 0}


def test_staff_edit_the_leaders_briefing_for_today_only_for_their_leader(client):
    s, m, other = hdr(client, "staff_s"), hdr(client, "mla_s"), hdr(client, "min_x")
    auto = client.get("/api/team/briefing?lang=en", headers=s).json()
    assert auto["edited"] is False and auto["text"] == auto["auto"] and "MLA S" in auto["text"]
    assert client.get("/api/briefing?lang=en", headers=m).json()["text"] == auto["auto"]

    r = client.put("/api/team/briefing", headers=s, json={"lang": "en", "body": "Good morning sir. Only the road story matters today."})
    assert r.status_code == 200
    lead = client.get("/api/briefing?lang=en", headers=m).json()
    assert lead["text"] == "Good morning sir. Only the road story matters today." and lead["edited_by"] == "staff_s"
    assert client.get("/api/briefing?lang=te", headers=m).json()["edited_by"] is None            # other language untouched
    assert client.get("/api/briefing?lang=en", headers=other).json()["edited_by"] is None        # another leader untouched
    assert client.get("/api/briefing?lang=en", headers=s).json()["edited_by"] is None            # staff's own briefing untouched
    assert client.get("/api/team/briefing?lang=en", headers=hdr(client, "staff_m")).json()["edited"] is False
    assert client.put("/api/team/briefing", headers=s, json={"lang": "xx", "body": "x"}).status_code == 422

    assert client.delete("/api/team/briefing?lang=en", headers=hdr(client, "staff_s2")).status_code == 200   # any teammate can reset
    back = client.get("/api/briefing?lang=en", headers=m).json()
    assert back["text"] == auto["auto"] and back["edited_by"] is None


def test_the_person_given_a_task_is_emailed_once_and_not_for_self_assignment(client, monkeypatch):
    from app.services import notify_service
    sent = []
    monkeypatch.setattr(notify_service, "deliver", lambda kind, key, user, subject, body, force=False: sent.append((kind, key, user, subject)) or "sent")
    h = hdr(client, "staff_s")
    mine = client.post("/api/board/tasks", headers=h, json={"title": "Self task", "assigned_to": "staff_s"}).json()["task"]
    assert sent == []                                                       # gave it to myself: no email
    t = client.post("/api/board/tasks", headers=h, json={"title": "Check ward 4", "assigned_to": "staff_s2"}).json()["task"]
    assert sent == [("task", str(t["id"]), "staff_s2", "New task for you: Check ward 4")]
    client.patch(f"/api/board/tasks/{t['id']}", headers=h, json={"status": "doing"})              # a status change tells nobody
    client.patch(f"/api/board/tasks/{mine['id']}", headers=h, json={"assigned_to": "mla_s"})      # reassigned: the new person is told
    assert [x[2] for x in sent] == ["staff_s2", "mla_s"]
    client.post("/api/board/tasks", headers=h, json={"title": "Nobody yet"})
    assert len(sent) == 2


def test_a_failing_email_never_breaks_the_task(client, monkeypatch):
    from app.services import notify_service
    monkeypatch.setattr(notify_service, "_smtp_send", lambda *a, **k: (_ for _ in ()).throw(OSError("mail server down")))
    monkeypatch.setattr(notify_service, "email_configured", lambda: True)
    r = client.post("/api/board/tasks", headers=hdr(client, "staff_s"), json={"title": "Still saved", "assigned_to": "staff_s2"})
    assert r.status_code == 200 and r.json()["task"]["title"] == "Still saved"
