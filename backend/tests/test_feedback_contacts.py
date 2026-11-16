"""
Story feedback + admin quality summary, app feedback, and the contact-data importer (needs a throwaway Postgres).
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


@pytest.fixture(scope="module")
def client():
    c = get_connection(); cur = c.cursor()
    cur.execute("DROP TABLE IF EXISTS team_task_notes, team_tasks, briefing_edits, story_feedback, app_feedback, notification_log, audit_log, refresh_tokens, device_tokens, share_replies, "
                "share_recipients, shares, social_media_posts, tasks, political_representatives, new_articles, archive_news, users CASCADE")
    c.commit()
    cur.execute((MIG / "000_base_schema.sql").read_text())
    cur.execute("""CREATE TABLE IF NOT EXISTS archive_news (id BIGINT PRIMARY KEY, title TEXT NOT NULL, district VARCHAR(100) DEFAULT 'Statewide',
        constituency VARCHAR(100) DEFAULT 'Statewide', constituencies TEXT[] DEFAULT '{}', civic_constituencies TEXT[] DEFAULT '{}',
        state VARCHAR(100) DEFAULT 'Telangana', summary TEXT, sources JSONB DEFAULT '[]'::jsonb, published_at TIMESTAMPTZ, created_at TIMESTAMPTZ,
        sentiment VARCHAR(20) DEFAULT 'positive', is_statewide BOOLEAN DEFAULT FALSE, archived_at TIMESTAMPTZ DEFAULT now())""")
    for f in ("001_auth_and_shares.sql", "003_mobile.sql", "004_share_pair_guard.sql", "005_audit_and_password_age.sql", "006_alerts_feedback.sql", "007_team_board.sql", "008_leader_title.sql"):
        cur.execute((MIG / f).read_text())
    h = hash_password(PW)
    for u, role in [("admin", "admin"), ("mla_s", "mla"), ("staff_s", "staff")]:
        cur.execute("INSERT INTO users (username,password_hash,role,politician_name,constituency_name,district_name,mla_username) VALUES (%s,%s,%s,%s,'Sircilla','Rajanna',%s)",
                    (u, h, role, u, "mla_s" if role == "staff" else None))
    for name, cons, dist, party in [("Achampet MLA", "Achampet (SC)", "Nagarkurnool", "INC"), ("Adilabad MLA", "Adilabad", "Adilabad", "BJP")]:
        cur.execute("INSERT INTO political_representatives (name, role_type, party, district_name, constituency_name) VALUES (%s,'MLA',%s,%s,%s)", (name, party, dist, cons))
    c.commit(); cur.close(); c.close()
    from app.main import app
    return TestClient(app)


def hdr(c, u):
    r = c.post("/api/login", json={"username": u, "password": PW}).json()
    assert r["status"] == "success", r
    return {"Authorization": f"Bearer {r['token']}"}


def post_csv(c, text, dry_run, who="admin"):
    return c.post(f"/api/representatives/import?dry_run={'true' if dry_run else 'false'}", headers=hdr(c, who), json={"csv": text})


# ── story + app feedback ─────────────────────────────────────────────────────
def test_story_feedback_is_recorded_once_per_person_and_reason(client):
    h = hdr(client, "staff_s")
    body = {"article_id": 42, "title": "Road repair begins", "kind": "wrong_priority"}
    assert client.post("/api/feedback/story", headers=h, json=body).json()["recorded"] is True
    assert client.post("/api/feedback/story", headers=h, json=body).json()["recorded"] is False     # same person + reason: ignored
    assert client.post("/api/feedback/story", headers=hdr(client, "mla_s"), json=body).json()["recorded"] is True
    assert client.post("/api/feedback/story", headers=h, json={**body, "kind": "bogus"}).status_code == 422
    assert client.post("/api/feedback/story", json=body).status_code == 401


def test_admin_sees_quality_summary_and_app_feedback(client):
    client.post("/api/feedback/story", headers=hdr(client, "mla_s"), json={"article_id": 43, "title": "Cinema gossip", "kind": "not_relevant"})
    assert client.post("/api/feedback/app", headers=hdr(client, "staff_s"), json={"message": "The send button is hard to find"}).status_code == 200
    assert client.post("/api/feedback/app", headers=hdr(client, "staff_s"), json={"message": "x"}).status_code == 422
    d = client.get("/api/dashboard", headers=hdr(client, "admin")).json()
    q = d["quality"]
    assert q["total"] == 3 and q["by_kind"]["wrong_priority"] == 2 and q["by_kind"]["not_relevant"] == 1
    assert q["top"][0]["article_id"] == 42 and q["top"][0]["reports"] == 2
    assert d["app_feedback"][0]["username"] == "staff_s" and "hard to find" in d["app_feedback"][0]["message"]
    assert "quality" not in client.get("/api/dashboard", headers=hdr(client, "mla_s")).json()      # admin only


# ── contact import ───────────────────────────────────────────────────────────
CSV = ("constituency,name,phone,email,party,role_type,district\n"
       "Achampet,,+91 98765 43210,achampet@example.org,,,\n"              # updates the MLA (matches despite the (SC) suffix)
       "Adilabad,Wrong Name,,adilabad@example.org,,MLA,\n"                # name differs: warning, still updates
       "Nowhere,,98765 43210,,,,\n"                                       # unknown constituency
       "Adilabad,,12ab,,,,\n"                                             # bad phone
       "Adilabad,,,bad-email,,,\n"                                        # bad email
       ",Chief Person,+91 90000 11111,cm@example.org,INC,CM,Hyderabad\n"  # a new person (CM)
       ",,,,,,\n")


def test_import_requires_admin(client):
    assert post_csv(client, CSV, True, "mla_s").status_code == 403
    assert client.post("/api/representatives/import", json={"csv": CSV}).status_code == 401


def test_dry_run_changes_nothing_and_reports_problems(client):
    r = post_csv(client, CSV, True).json()
    assert r["dry_run"] is True and r["will_update"] == 2 and r["will_add"] == 1
    assert {e["row"] for e in r["errors"]} == {4, 5, 6}                       # unknown constituency, bad phone, bad email
    assert any("kept 'Adilabad MLA'" in w["warning"] for w in r["warnings"])
    reps = client.get("/api/representatives", headers=hdr(client, "mla_s")).json()["representatives"]
    assert all(x["contact_phone"] is None and x["email"] is None for x in reps)       # still blank
    assert not any(x["name"] == "Chief Person" for x in reps)


def test_apply_updates_adds_and_is_repeatable(client):
    r = post_csv(client, CSV, False).json()
    assert r["updated"] == 2 and r["added"] == 1
    reps = {x["name"]: x for x in client.get("/api/representatives", headers=hdr(client, "mla_s")).json()["representatives"]}
    assert reps["Achampet MLA"]["contact_phone"] == "+91 98765 43210" and reps["Achampet MLA"]["email"] == "achampet@example.org"
    assert reps["Adilabad MLA"]["email"] == "adilabad@example.org" and reps["Adilabad MLA"]["contact_phone"] is None
    assert reps["Adilabad MLA"]["name"] == "Adilabad MLA"                       # the existing name was kept
    assert reps["Chief Person"]["role_type"] == "CM" and reps["Chief Person"]["email"] == "cm@example.org"
    again = post_csv(client, CSV, False).json()
    assert again["added"] == 0 and again["updated"] == 3                        # the CM now matches, so it is an update, not a duplicate
    n = get_connection(); cur = n.cursor(); cur.execute("SELECT COUNT(*) FROM political_representatives WHERE name='Chief Person'")
    assert cur.fetchone()[0] == 1; cur.close(); n.close()


def test_bad_files_are_refused(client):
    assert post_csv(client, "just some words", True).status_code == 422
    assert post_csv(client, "a,b\n1,2\n", True).status_code == 422


def test_unfilled_rows_of_a_prepared_sheet_are_skipped_quietly(client):
    sheet = ("constituency,name,phone,email,party,role_type,district\n"
             "Achampet (SC),Achampet MLA,,,INC,,Nagarkurnool\n"       # nothing filled in yet: skipped, not an error
             "Adilabad,Adilabad MLA,+91 91234 56789,,BJP,,Adilabad\n")
    r = post_csv(client, sheet, True).json()
    assert r["skipped_blank"] == 1 and r["errors"] == [] and r["will_update"] == 1
