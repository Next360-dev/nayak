"""
"Refresh news now": the service (cooldown, one at a time, errors) and the endpoints (who may use it, what scope it gets).
The service tests need no database. The endpoint tests need the throwaway Postgres (see test_shares.py).
"""
import os
import threading
import time

import pytest

from app.services.refresh_service import FULL_COOLDOWN_SECONDS, QUICK_COOLDOWN_SECONDS, RefreshService


class Clock:
    def __init__(self): self.t = 1000.0
    def __call__(self): return self.t


def wait_idle(svc, key, secs=3):
    end = time.time() + secs
    while time.time() < end:
        if svc._running is None:
            return
        time.sleep(0.01)
    raise AssertionError("refresh never finished")


def test_quick_refresh_runs_once_then_cools_down():
    clock, calls = Clock(), []
    svc = RefreshService(quick=lambda c, d: calls.append((c, d)) or {"new": 3, "updated": 1, "found": 9, "at": "x"}, clock=clock)
    first = svc.start("Sircilla", "Sircilla", "Rajanna Sircilla")
    assert first["state"] == "running" and first["started"] is True
    wait_idle(svc, "Sircilla")
    st = svc.status("Sircilla")
    assert st["state"] == "cooldown" and st["last"]["new"] == 3 and st["last"]["ok"] is True
    again = svc.start("Sircilla", "Sircilla", "Rajanna Sircilla")
    assert again["state"] == "cooldown" and again["wait"] > 0 and calls == [("Sircilla", "Rajanna Sircilla")]
    clock.t += QUICK_COOLDOWN_SECONDS + 1
    assert svc.status("Sircilla")["state"] == "idle"
    assert svc.start("Sircilla", "Sircilla", "Rajanna Sircilla")["started"] is True      # allowed again after the cooldown
    wait_idle(svc, "Sircilla")


def test_only_one_refresh_runs_at_a_time():
    gate = threading.Event()
    svc = RefreshService(quick=lambda c, d: gate.wait(3) and {"new": 0, "updated": 0}, clock=Clock())
    assert svc.start("A", "A", None)["started"] is True
    other = svc.start("B", "B", None)                              # a different team asks while A runs
    assert other["state"] == "running" and other["mine"] is False and "started" not in other
    assert svc.status("A")["mine"] is True
    gate.set(); wait_idle(svc, "A")


def test_a_failure_is_reported_plainly_and_never_crashes():
    def boom(c, d): raise RuntimeError("web source unreachable")
    svc = RefreshService(quick=boom, clock=Clock())
    svc.start("A", "A", None); wait_idle(svc, "A")
    last = svc.status("A")["last"]
    assert last["ok"] is False and "unreachable" in last["error"] and last["new"] == 0


def test_full_run_for_people_without_a_constituency_and_on_done_hook():
    done = []
    svc = RefreshService(full=lambda: {"new": 5, "updated": 0, "found": None, "at": "x"}, clock=Clock())
    assert RefreshService.scope_key("All") == "*" and RefreshService.scope_key(None) == "*" and RefreshService.scope_key("Sircilla") == "Sircilla"
    svc.start("*", None, None, on_done=lambda: done.append(1)); wait_idle(svc, "*")
    assert svc.status("*")["last"]["new"] == 5 and done == [1]
    assert svc.status("*")["wait"] <= FULL_COOLDOWN_SECONDS + 1


# ── endpoints (throwaway database) ───────────────────────────────────────────
if os.getenv("ASO_TEST_DB"):
    from test_team_board import client, hdr  # noqa: F401  (same users: admin, mla_s, min_x, staff_s, staff_m ...)
    from app.core.database import get_connection
    from app.services import refresh_service as rs

    def _fresh(monkeypatch, record):
        svc = RefreshService(quick=lambda c, d: record.append(("quick", c, d)) or {"new": 2, "updated": 1, "found": 4, "at": "x"},
                             full=lambda: record.append(("full",)) or {"new": 7, "updated": 0, "found": None, "at": "x"})
        monkeypatch.setattr("app.api.routes.news.refresh_service", svc)
        return svc

    def test_refresh_needs_a_login(client):
        assert client.post("/api/news/refresh").status_code == 401
        assert client.get("/api/news/refresh/status").status_code == 401

    def test_staff_refresh_is_scoped_to_their_leaders_constituency(client, monkeypatch):
        rec = []
        svc = _fresh(monkeypatch, rec)
        r = client.post("/api/news/refresh", headers=hdr(client, "staff_s")).json()
        assert r["state"] == "running" and r["started"] is True and r["scope"] == "Sircilla"
        wait_idle(svc, "Sircilla")
        assert rec == [("quick", "Sircilla", "Rajanna Sircilla")]          # the leader's constituency, never another team's
        st = client.get("/api/news/refresh/status", headers=hdr(client, "mla_s")).json()
        assert st["last"]["new"] == 2 and st["latest_story_at"]
        again = client.post("/api/news/refresh", headers=hdr(client, "mla_s")).json()    # the leader shares the team's cooldown
        assert again["state"] == "cooldown" and rec == [("quick", "Sircilla", "Rajanna Sircilla")]
        c = get_connection(); cur = c.cursor()
        cur.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'news_refresh' AND actor = 'staff_s'")
        assert cur.fetchone()[0] == 1; cur.close(); c.close()

    def test_minister_and_admin_start_the_full_run(client, monkeypatch):
        rec = []
        svc = _fresh(monkeypatch, rec)
        assert client.post("/api/news/refresh", headers=hdr(client, "min_x")).json()["started"] is True
        wait_idle(svc, "*")
        assert rec == [("full",)]
        assert client.get("/api/news/refresh/status", headers=hdr(client, "admin")).json()["last"]["new"] == 7
