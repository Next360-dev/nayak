"""
Alerts by email, send-once rule, admin checks, morning briefing, contact details (needs a throwaway Postgres).
A fake mail sender is used: nothing real is ever sent.
"""
import json
import os
import pathlib
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

if not os.getenv("ASO_TEST_DB"):
    pytest.skip("set ASO_TEST_DB=1 and DB_* to a throwaway database", allow_module_level=True)

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import get_connection
from app.core.security import hash_password
from app.services import alerts_service, notify_service

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
    for u, role, pol, con, dist, boss, email, lang in [
        ("admin", "admin", "Admin", "All", "All", None, "admin@example.test", "en"),
        ("mla_s", "mla", "MLA S", "Sircilla", "Rajanna Sircilla", None, "mla@example.test", "en"),
        ("mla_te", "mla", "MLA Te", "Mulugu", "Mulugu", None, "te@example.test", "te"),
        ("staff_s", "staff", "", "", "", "mla_s", None, "en"),
    ]:
        cur.execute("INSERT INTO users (username,password_hash,role,politician_name,constituency_name,district_name,mla_username,email,lang) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)", (u, h, role, pol, con, dist, boss, email, lang))
    src = json.dumps([{"publisher": "Test Paper", "url": "https://example.com/a"}])
    for title, cons, senti in [("Road repair begins in Sircilla", "Sircilla", "positive"), ("Water shortage protest in Sircilla", "Sircilla", "negative")]:
        cur.execute("INSERT INTO new_articles (title,district,constituency,summary,sources,sentiment,constituencies) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                    (title, "Rajanna Sircilla", cons, "Summary.", src, senti, [cons]))
    c.commit(); cur.close(); c.close()
    from app.main import app
    return TestClient(app)


@pytest.fixture()
def outbox(monkeypatch):
    """Switch email 'on' with a fake sender that records every message."""
    sent = []
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.test")
    monkeypatch.setattr(settings, "SMTP_FROM", "alerts@example.test")
    monkeypatch.setattr(notify_service, "_smtp_send", lambda to, subject, body: sent.append({"to": to, "subject": subject, "body": body}))
    conn = get_connection(); cur = conn.cursor(); cur.execute("DELETE FROM notification_log"); conn.commit(); cur.close(); conn.close()
    return sent


def hdr(c, u):
    r = c.post("/api/login", json={"username": u, "password": PW}).json()
    assert r["status"] == "success", r
    return {"Authorization": f"Bearer {r['token']}"}


# ── contact details ──────────────────────────────────────────────────────────
def test_profile_validation_and_roundtrip(client):
    h = hdr(client, "staff_s")
    assert client.get("/api/me/profile", headers=h).json()["email"] is None
    bad = {"email": "not-an-email", "alerts_enabled": True, "lang": "en"}
    assert client.put("/api/me/profile", headers=h, json=bad).status_code == 422
    assert client.put("/api/me/profile", headers=h, json={"phone": "12ab", "lang": "en"}).status_code == 422
    assert client.put("/api/me/profile", headers=h, json={"lang": "fr"}).status_code == 422
    ok = client.put("/api/me/profile", headers=h, json={"email": "staff@example.test", "phone": "+91 98765 43210", "alerts_enabled": True, "lang": "te"})
    assert ok.status_code == 200 and ok.json()["email"] == "staff@example.test" and ok.json()["lang"] == "te"
    assert client.get("/api/me/profile", headers=h).json()["phone"] == "+91 98765 43210"
    assert client.get("/api/me/profile").status_code == 401


# ── urgent share alerts ──────────────────────────────────────────────────────
def test_urgent_share_emails_the_receiver_once(client, outbox):
    st = hdr(client, "staff_s")
    r = client.post("/api/shares", headers=st, json={"title": "Bridge cracked", "recipients": ["mla_s"], "priority": "urgent", "note": "see photo"})
    assert r.status_code == 200
    assert [m["to"] for m in outbox] == ["mla@example.test"]
    assert outbox[0]["subject"] == "Urgent: Bridge cracked" and "see photo" in outbox[0]["body"] and settings.APP_BASE_URL in outbox[0]["body"]
    sid = r.json()["share_id"]
    alerts_service.notify_urgent_share("staff_s", "Bridge cracked", sid, ["mla_s"])     # same share again: send-once
    assert len(outbox) == 1


def test_normal_share_sends_no_email(client, outbox):
    assert client.post("/api/shares", headers=hdr(client, "staff_s"), json={"title": "Just FYI", "recipients": ["mla_s"]}).status_code == 200
    assert outbox == []


def test_alerts_switch_and_missing_setup_are_respected(client, outbox, monkeypatch):
    conn = get_connection(); cur = conn.cursor(); cur.execute("UPDATE users SET alerts_enabled=FALSE WHERE username='mla_s'"); conn.commit()
    assert notify_service.deliver("k", "1", "mla_s", "s", "b") == "skipped:alerts_off"
    cur.execute("UPDATE users SET alerts_enabled=TRUE WHERE username='mla_s'"); conn.commit(); cur.close(); conn.close()
    cur2 = get_connection(); c2 = cur2.cursor()
    c2.execute("INSERT INTO users (username,password_hash,role,politician_name,constituency_name,district_name,mla_username) "
               "VALUES ('noemail',%s,'staff','','','','mla_s') ON CONFLICT DO NOTHING", (hash_password(PW),)); cur2.commit(); c2.close(); cur2.close()
    assert notify_service.deliver("k", "2", "noemail", "s", "b") == "skipped:no_email"
    monkeypatch.setattr(settings, "SMTP_HOST", "")
    assert notify_service.deliver("k", "3", "mla_s", "s", "b") == "skipped:not_configured"
    assert outbox == []


def test_a_failing_mail_server_never_breaks_the_share(client, outbox, monkeypatch):
    def boom(*a, **k): raise OSError("smtp down")
    monkeypatch.setattr(notify_service, "_smtp_send", boom)
    r = client.post("/api/shares", headers=hdr(client, "staff_s"), json={"title": "Fire", "recipients": ["mla_s"], "priority": "urgent"})
    assert r.status_code == 200
    conn = get_connection(); cur = conn.cursor(); cur.execute("SELECT ok, error FROM notification_log WHERE kind='urgent_share' ORDER BY id DESC LIMIT 1")
    ok, err = cur.fetchone(); cur.close(); conn.close()
    assert ok is False and "smtp down" in err


def test_telugu_receiver_gets_telugu_alert(client, outbox):
    conn = get_connection(); cur = conn.cursor(); cur.execute("INSERT INTO users (username,password_hash,role,politician_name,constituency_name,district_name,mla_username) "
        "VALUES ('staff_te',%s,'staff','','','','mla_te') ON CONFLICT DO NOTHING", (hash_password(PW),)); conn.commit(); cur.close(); conn.close()
    assert client.post("/api/shares", headers=hdr(client, "staff_te"), json={"title": "వంతెన పగిలింది", "recipients": ["mla_te"], "priority": "urgent"}).status_code == 200
    assert outbox[0]["subject"].startswith("అత్యవసరం:") and "యాప్ తెరవండి" in outbox[0]["body"]


# ── admin checks ─────────────────────────────────────────────────────────────
def test_admin_is_told_once_when_news_goes_stale(client, outbox):
    conn = get_connection(); cur = conn.cursor(); cur.execute("UPDATE new_articles SET created_at = now() - interval '9 hours'"); conn.commit(); cur.close(); conn.close()
    assert alerts_service.run_admin_checks() >= 1
    assert any(m["to"] == "admin@example.test" and "No new stories" in m["subject"] for m in outbox)
    before = len(outbox)
    assert alerts_service.run_admin_checks() == 0 and len(outbox) == before        # same stale episode: not again


def test_admin_is_told_about_a_share_left_unopened_for_a_day(client, outbox):
    conn = get_connection(); cur = conn.cursor()
    cur.execute("UPDATE new_articles SET created_at = now()"); cur.execute("UPDATE shares SET created_at = now() - interval '2 days'")
    cur.execute("UPDATE share_recipients SET status='new'"); conn.commit(); cur.close(); conn.close()
    assert alerts_service.run_admin_checks() >= 1
    assert any("has not opened a share" in m["subject"] for m in outbox)


# ── briefing ─────────────────────────────────────────────────────────────────
def test_briefing_text_for_each_kind_of_user(client):
    leader = client.get("/api/briefing", headers=hdr(client, "mla_s")).json()
    assert leader["kind"] == "mla" and "MLA S" in leader["text"] and "Sircilla" in leader["text"] and "Top stories" in leader["text"]
    assert "Water shortage" in leader["text"]
    staff = client.get("/api/briefing", headers=hdr(client, "staff_s")).json()
    assert staff["kind"] == "staff" and "My sent:" in staff["text"]
    admin = client.get("/api/briefing", headers=hdr(client, "admin")).json()
    assert admin["kind"] == "admin" and "Control Room" in admin["text"] and "Database:" in admin["text"]
    te = client.get("/api/briefing?lang=te", headers=hdr(client, "mla_s")).json()
    assert "శుభోదయం" in te["text"] and "ముఖ్య వార్తలు" in te["text"]
    assert client.get("/api/briefing").status_code == 401


def test_morning_briefing_goes_out_once_per_day_after_the_set_hour(client, outbox):
    tz = ZoneInfo(settings.TIMEZONE)
    early = datetime(2026, 11, 15, settings.BRIEFING_HOUR - 1 if settings.BRIEFING_HOUR > 0 else 0, 0, tzinfo=tz)
    if settings.BRIEFING_HOUR > 0:
        assert alerts_service.run_briefings(early) == 0
    later = datetime(2026, 11, 15, settings.BRIEFING_HOUR, 5, tzinfo=tz)
    n = alerts_service.run_briefings(later)
    recipients = {m["to"] for m in outbox}
    assert n == len(outbox) >= 3 and {"admin@example.test", "mla@example.test", "te@example.test"} <= recipients
    assert alerts_service.run_briefings(later) == 0                                   # already sent today
    assert alerts_service.run_briefings(datetime(2026, 11, 16, settings.BRIEFING_HOUR, 5, tzinfo=tz)) >= 3   # a new day


# ── test email + email-me ────────────────────────────────────────────────────
def test_test_email_and_email_me_need_setup_and_an_address(client, outbox, monkeypatch):
    h = hdr(client, "mla_s")
    r = client.post("/api/me/test-alert", headers=h)
    assert r.status_code == 200 and outbox[-1]["to"] == "mla@example.test"
    assert client.post("/api/briefing/email-me?lang=en", headers=h).json()["sent_to"] == "mla@example.test"
    conn = get_connection(); cur = conn.cursor(); cur.execute("UPDATE users SET email=NULL WHERE username='mla_s'"); conn.commit()
    assert client.post("/api/me/test-alert", headers=h).status_code == 422
    cur.execute("UPDATE users SET email='mla@example.test' WHERE username='mla_s'"); conn.commit(); cur.close(); conn.close()
    monkeypatch.setattr(settings, "SMTP_HOST", "")
    assert client.post("/api/me/test-alert", headers=h).status_code == 409
