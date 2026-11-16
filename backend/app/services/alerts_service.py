"""
services/alerts_service.py - alerts that reach people when the app is closed (email), and the daily briefing runner.

  urgent share      -> the receiver (right after the share is created)
  news is stale     -> every admin (once per stale episode)
  share unopened >24h -> every admin (once per share)
  morning briefing  -> every user with an email (once per day, after BRIEFING_HOUR)

Everything is OFF until SMTP is configured. All sends go through notify_service (send-once, never raises).
"""
import logging
import threading
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.repositories import user_repository
from app.services import briefing_service, dashboard_service, notify_service

logger = logging.getLogger(__name__)


def notify_urgent_share(sender: str, title: str, share_id: int, recipients: list[str], note: str | None = None) -> None:
    for r in recipients or []:
        try:
            _notify_one_urgent(sender, title, share_id, r, note)
        except Exception:
            logger.warning("urgent-share alert for %s failed", r, exc_info=True)


def _notify_one_urgent(sender: str, title: str, share_id: int, r: str, note: str | None) -> None:
    if True:
        who = user_repository.contact_of(r)
        lang = who["lang"] if who else "en"
        if lang == "te":
            subject, intro, open_ = f"అత్యవసరం: {title}", f"{sender} మీకు ఒక అత్యవసర వార్తను పంపారు.", "యాప్ తెరవండి"
        else:
            subject, intro, open_ = f"Urgent: {title}", f"{sender} sent you an urgent story.", "Open the app"
        body = f"{intro}\n\n{title}\n" + (f"\n“{note}”\n" if note else "") + f"\n{open_}: {settings.APP_BASE_URL}\n"
        notify_service.deliver("urgent_share", f"share-{share_id}", r, subject, body)


def run_admin_checks() -> int:
    """Emails admins about a stale news feed and shares that sat unopened for a day. Returns how many were sent."""
    if not notify_service.email_configured():
        return 0
    admins = [u for u in user_repository.list_alertable_users() if u["role"] == "admin"]
    if not admins:
        return 0
    todo: list[tuple[str, str, str, str]] = []
    health = dashboard_service.system_health()
    if health.get("news_is_stale"):
        todo.append(("news_stale", str(health.get("latest_article_at") or "never"),
                     "No new stories for over 6 hours",
                     "The news scraper may have stopped, or the sources are blocking it. Open the Control Room and use "
                     f"\"Run news update now\".\n\n{settings.APP_BASE_URL}\n"))
    now = datetime.now(timezone.utc)
    for l in user_repository.leaders_overview():
        old = l.get("oldest_unseen_share")
        if old and now - datetime.fromisoformat(old) > timedelta(hours=24):
            who = l["politician_name"] or l["username"]
            todo.append(("unopened", f"{l['username']}:{old}", f"{who} has not opened a share for over a day",
                         f"{who} has {l['shares']['new']} unopened share(s). The oldest is from {old}.\n\n{settings.APP_BASE_URL}\n"))
    sent = 0
    for kind, key, subject, body in todo:
        for a in admins:
            sent += notify_service.deliver(kind, key, a["username"], subject, body) == "sent"
    return sent


def run_briefings(now: datetime | None = None) -> int:
    """Sends today's briefing to everyone with an email, once per day, after BRIEFING_HOUR (local time)."""
    if not notify_service.email_configured():
        return 0
    now = now or datetime.now(ZoneInfo(settings.TIMEZONE))
    if now.hour < settings.BRIEFING_HOUR:
        return 0
    key = now.date().isoformat()
    sent = 0
    for c in user_repository.list_alertable_users():
        user = user_repository.find_user_by_username(c["username"])
        if not user:
            continue
        try:
            b = briefing_service.build(user, c["lang"])
        except Exception:
            logger.warning("briefing build failed for %s", c["username"], exc_info=True)
            continue
        sent += notify_service.deliver("briefing", key, c["username"], b["title"], b["text"]) == "sent"
    return sent


_started = False


def start_scheduler() -> None:
    """Background thread: checks alerts and briefings every ALERT_CHECK_MINUTES. Safe to call twice."""
    global _started
    if _started:
        return
    _started = True

    def loop():
        time.sleep(60)
        while True:
            try:
                run_admin_checks()
                run_briefings()
            except Exception:
                logger.warning("alert loop error", exc_info=True)
            time.sleep(max(1, settings.ALERT_CHECK_MINUTES) * 60)

    threading.Thread(target=loop, daemon=True, name="AlertsDaemon").start()
