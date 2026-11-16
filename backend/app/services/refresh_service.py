"""
services/refresh_service.py - the "Refresh news now" button for the team.

Anyone in a team (MLA, minister, staff) can ask for fresh stories without waiting for the 3-hour robot.
* A person with a constituency gets a QUICK refresh of just that constituency (+ the leader by name + the district): seconds.
* A person without one (a minister, the admin) starts the full run (about a minute).
Rules that keep the web sources (and our server) safe: only ONE refresh runs at a time, and each scope has a short cooldown.
The cooldown and results live in memory (one app process, see docs/DEPLOY.md), so they reset on restart, which is fine.
"""
import threading
import time
from datetime import datetime, timezone
from typing import Callable

from app.core.database import get_connection

QUICK_COOLDOWN_SECONDS = 45
FULL_COOLDOWN_SECONDS = 180


def _quick(constituency: str, district: str | None) -> dict:
    from main_pipeline import run_quick_refresh
    return run_quick_refresh(constituency, district)


def _full() -> dict:
    from automation.manager import automation_manager
    out = automation_manager.run_cycle_sync("manual_refresh")
    if out.get("status") == "already_running":
        raise RuntimeError("The scheduled update is running right now. Try again in a minute.")
    return {"found": None, "new": out.get("db_inserted", 0), "updated": out.get("db_updated", 0),
            "seconds": out.get("duration_seconds"), "at": datetime.now(timezone.utc).isoformat()}


class RefreshService:
    def __init__(self, quick: Callable = _quick, full: Callable = _full, clock: Callable = time.time):
        self._quick, self._full, self._clock = quick, full, clock
        self._lock = threading.Lock()
        self._running: str | None = None
        self._last: dict[str, dict] = {}

    @staticmethod
    def scope_key(constituency: str | None) -> str:
        return constituency if constituency and constituency != "All" else "*"

    def status(self, key: str) -> dict:
        with self._lock:
            last = self._last.get(key)
            wait = 0
            if last:
                cool = FULL_COOLDOWN_SECONDS if key == "*" else QUICK_COOLDOWN_SECONDS
                wait = max(0, int(cool - (self._clock() - last["finished"])) + 1) if self._clock() - last["finished"] < cool else 0
            state = "running" if self._running else ("cooldown" if wait else "idle")
            return {"state": state, "mine": self._running == key, "wait": wait, "last": last["result"] if last else None}

    def start(self, key: str, constituency: str | None, district: str | None, on_done: Callable | None = None) -> dict:
        with self._lock:
            if self._running:
                return {"state": "running", "mine": self._running == key, "wait": 0, "last": (self._last.get(key) or {}).get("result")}
            last = self._last.get(key)
            cool = FULL_COOLDOWN_SECONDS if key == "*" else QUICK_COOLDOWN_SECONDS
            if last and self._clock() - last["finished"] < cool:
                return {"state": "cooldown", "mine": False, "wait": int(cool - (self._clock() - last["finished"])) + 1, "last": last["result"]}
            self._running = key
        threading.Thread(target=self._work, args=(key, constituency, district, on_done), daemon=True, name="NewsRefresh").start()
        return {"state": "running", "mine": True, "started": True, "wait": 0, "last": (last or {}).get("result")}

    def _work(self, key, constituency, district, on_done):
        try:
            result = self._full() if key == "*" else self._quick(constituency, district)
            result = {**result, "ok": True}
        except Exception as exc:                      # never let a web hiccup crash the app; the person sees a plain message
            result = {"ok": False, "error": str(exc)[:200], "new": 0, "updated": 0, "at": datetime.now(timezone.utc).isoformat()}
        with self._lock:
            self._last[key] = {"finished": self._clock(), "result": result}
            self._running = None
        if on_done:
            try:
                on_done()
            except Exception:
                pass


refresh_service = RefreshService()


def latest_story_time(constituency: str | None):
    """When the newest stored story for this scope arrived (None if there is none)."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        if constituency and constituency != "All":
            cur.execute("SELECT MAX(created_at) FROM new_articles WHERE constituency = %s OR %s = ANY(constituencies)", (constituency, constituency))
        else:
            cur.execute("SELECT MAX(created_at) FROM new_articles")
        row = cur.fetchone()
        cur.close()
        return row[0].isoformat() if row and row[0] else None
    finally:
        conn.close()
