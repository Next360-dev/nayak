"""
services/dashboard_service.py - what each login's HOME screen shows (core logic, no HTTP).

  admin    -> Control Room: system health, what needs attention, leaders, recent share activity
  mla      -> My Constituency: what is waiting for me, urgent issues, my team
  minister -> State Overview: districts needing attention, urgent statewide, my team
  staff    -> Work Queue: stories to review/send, status of what I sent, what my leader sent me

News numbers are computed through the same scoped news service as the feed, so a login can never
see counts or stories outside its own scope.
"""
from datetime import datetime, timedelta, timezone

from app.core.ttl_cache import TTLCache
from app.repositories import audit_repository, feedback_repository, share_repository, system_repository, user_repository
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.repositories import board_repository
from app.services import auth_service, news_service

_news_cache = TTLCache()
NEWS_BLOCK_TTL = 60  # seconds: the news only changes when the scraper runs (every 3 h)

STALE_AFTER = timedelta(hours=6)       # the scraper runs every 3 h; two missed cycles = something is wrong
UNSEEN_AFTER = timedelta(hours=24)     # a share nobody has opened for a day needs a nudge
STORY_FIELDS = ("id", "headline", "summary", "url", "district_name", "constituency_name",
                "priority_score", "sentiment", "date_time", "source")


# ── system health (also used by /api/admin/overview) ─────────────────────────
def system_health() -> dict:
    """Facts the master admin needs to diagnose the system. Never raises: a failure is reported, not hidden."""
    health: dict = {"database": "up"}
    try:
        fresh = system_repository.news_freshness()
        latest = fresh.pop("_latest")
        health.update(fresh)
        health["news_is_stale"] = latest is None or (datetime.now(timezone.utc) - latest) > STALE_AFTER
    except Exception:
        health.update({"database": "down", "articles_last_24h": None, "latest_article_at": None, "news_is_stale": True})
    try:
        from automation.manager import automation_manager
        st = automation_manager.get_status()
        summ = st.get("last_summary") or {}
        health["scraper"] = {
            "is_running": st.get("is_running"), "stage": st.get("current_stage"),
            "last_run_end": st.get("last_run_end"), "last_status": summ.get("status"),
            "last_inserted": summ.get("db_inserted"), "next_run": st.get("next_scheduled_run"),
            "runs_completed": st.get("total_runs_completed"),
        }
    except Exception:
        health["scraper"] = None
    return health


# ── news block (scoped exactly like the news feed) ───────────────────────────
def _story(a: dict) -> dict:
    return {k: a.get(k) for k in STORY_FIELDS}


def _attention_order(articles: list[dict]) -> list[dict]:
    """Most urgent first, then negative, then newest."""
    newest = sorted(articles, key=lambda a: a.get("date_time") or "", reverse=True)
    return sorted(newest, key=lambda a: (a.get("priority_score") or 3, 0 if a.get("sentiment") == "negative" else 1))


def _news_block(user: dict, statewide_view: bool) -> dict:
    """Cached per scope: everyone in the same scope shares one computation (key = everything that changes the answer)."""
    scoped = auth_service.is_scoped(user)
    key = ("news_block", scoped, statewide_view, user["role"] if not scoped else "scoped",
           user["constituency_name"] if scoped else None, user["district_name"] if scoped else None,
           user["politician_name"] if scoped else None)
    return _news_cache.get_or_compute(key, NEWS_BLOCK_TTL, lambda: _compute_news_block(user, statewide_view, scoped))


def _compute_news_block(user: dict, statewide_view: bool, scoped: bool) -> dict:
    if scoped and user["constituency_name"] in ("All", ""):
        return {"error": "Your account has no constituency assigned."}
    try:
        res = news_service.get_news_feed(
            period="today", news_scope="all", page=1, limit=200,
            user_role="mla" if scoped else user["role"],
            user_constituency=user["constituency_name"] if scoped else None,
            user_district=user["district_name"] if scoped else None,
            user_politician=user["politician_name"] if scoped else None,
        )
    except Exception:
        return {"error": "News could not be loaded right now."}
    arts = res.get("articles") or []
    counts = res.get("scope_counts") or {}
    urgent = [a for a in arts if a.get("priority_score") == 1]
    negative = [a for a in arts if a.get("sentiment") == "negative"]
    block = {
        "today": counts.get("all") or len(arts),
        "urgent": len(urgent),
        "negative": len(negative),
        "attention": [_story(a) for a in _attention_order(arts)[:6]],
    }
    if statewide_view:
        by: dict[str, dict] = {}
        for a in arts:
            d = a.get("district_name")
            if not d or d == "Statewide":
                continue
            row = by.setdefault(d, {"district": d, "total": 0, "urgent": 0, "negative": 0})
            row["total"] += 1
            row["urgent"] += 1 if a.get("priority_score") == 1 else 0
            row["negative"] += 1 if a.get("sentiment") == "negative" else 0
        block["districts"] = sorted(by.values(), key=lambda r: (r["urgent"], r["negative"], r["total"]), reverse=True)[:6]
    return block


def briefing_today():
    """Today's date in the office timezone (used for overdue task counts)."""
    return datetime.now(ZoneInfo(settings.TIMEZONE)).date()


# ── shares block ─────────────────────────────────────────────────────────────
def _count(statuses) -> dict:
    out = {"new": 0, "seen": 0, "acting": 0, "done": 0}
    for s in statuses:
        if s in out:
            out[s] += 1
    return out


def _shares_block(me: str) -> dict:
    inbox = share_repository.inbox(me, 200)
    sent = share_repository.sent(me, False, 200)
    inbox_counts = _count(i["status"] for i in inbox)
    sent_counts = _count(r["status"] for s in sent for r in s.get("recipients", []))
    return {
        "inbox": {**inbox_counts, "recent": [
            {"id": i["id"], "title": i["title"], "sender": i["sender"], "priority": i["priority"],
             "status": i["status"], "created_at": i["created_at"], "note": i.get("note"), "url": i.get("url")}
            for i in inbox if i["status"] != "done"][:5]},
        "sent": {**sent_counts, "waiting": sent_counts["new"] + sent_counts["seen"], "recent": [
            {"id": s["id"], "title": s["title"], "priority": s["priority"], "created_at": s["created_at"],
             "recipients": s.get("recipients", [])} for s in sent[:5]]},
    }


# ── per-role dashboards ──────────────────────────────────────────────────────
def _admin(user: dict) -> dict:
    now = datetime.now(timezone.utc)
    system = system_health()
    leaders = user_repository.leaders_overview()
    users = user_repository.list_all_users()
    all_shares = share_repository.sent(user["username"], True, 200)
    statuses = [r["status"] for s in all_shares for r in s.get("recipients", [])]
    sc = _count(statuses)

    never = [u["username"] for u in users if u["is_active"] and u["role"] != "admin" and not u["last_login"]]
    disabled = [u["username"] for u in users if not u["is_active"]]

    attention: list[dict] = []
    if system["database"] != "up":
        attention.append({"level": "bad", "code": "db_down", "params": {}, "text": "The database is not responding.", "action": "none"})
    if system["news_is_stale"]:
        attention.append({"level": "bad", "code": "news_stale", "params": {}, "action": "run_scraper",
                          "text": "No new stories for over 6 hours. The scraper may have stopped."})
    for l in leaders:
        old = l.get("oldest_unseen_share")
        if old and now - datetime.fromisoformat(old) > UNSEEN_AFTER:
            who = l["politician_name"] or l["username"]
            attention.append({"level": "warn", "action": "shares", "code": "leader_unopened",
                              "params": {"name": who, "n": l["shares"]["new"]},
                              "text": f"{who} has {l['shares']['new']} share(s) unopened for over a day."})
    if never:
        shown = ", ".join(never[:6]) + (f" and {len(never) - 6} more" if len(never) > 6 else "")
        attention.append({"level": "warn", "action": "users", "code": "never_logged_in",
                          "params": {"n": len(never), "names": shown},
                          "text": f"{len(never)} account(s) have never logged in: {shown}."})
    if disabled:
        attention.append({"level": "info", "action": "users", "code": "disabled", "params": {"n": len(disabled)},
                          "text": f"{len(disabled)} account(s) are disabled."})

    by_role = {r: sum(1 for u in users if u["role"] == r and u["is_active"]) for r in ("admin", "mla", "minister", "staff")}
    total = sum(sc.values())
    return {
        "system": system,
        "attention": attention,
        "users": {"by_role": by_role, "never_logged_in": len(never), "disabled": len(disabled)},
        "shares": {**sc, "total": len(all_shares), "resolved_pct": round(100 * sc["done"] / total) if total else None},
        "leaders": leaders,
        "audit": audit_repository.recent(8),
        "quality": feedback_repository.quality_summary(7),
        "app_feedback": feedback_repository.recent_app_feedback(5),
        "activity": [{"id": s["id"], "title": s["title"], "sender": s["sender"], "priority": s["priority"],
                      "created_at": s["created_at"], "recipients": s.get("recipients", [])} for s in all_shares[:10]],
    }


def _leader(user: dict) -> dict:
    me = user["username"].lower()
    return {
        "news": _news_block(user, statewide_view=user["role"] == "minister"),
        "shares": _shares_block(me),
        "team": user_repository.list_staff_of(me),
        "board": board_repository.summary(me, me, briefing_today()),
    }


def _staff(user: dict) -> dict:
    boss = user_repository.find_user_by_username(user.get("mla_username") or "")
    return {
        "news": _news_block(user, statewide_view=False),
        "shares": _shares_block(user["username"].lower()),
        "board": (board_repository.summary(boss["username"].lower(), user["username"].lower(), briefing_today()) if boss else None),
        "leader": ({"username": boss["username"], "role": boss["role"],
                    "name": boss["politician_name"] or boss["username"]} if boss else None),
    }


def build(user: dict) -> dict:
    role = user["role"]
    scoped = auth_service.is_scoped(user)
    body = _admin(user) if role == "admin" else _leader(user) if role in ("mla", "minister") else _staff(user)
    return {
        "status": "success",
        "kind": role,
        "scope": {"statewide": not scoped,
                  "label": "Telangana (statewide)" if not scoped else user["constituency_name"]},
        **body,
    }
