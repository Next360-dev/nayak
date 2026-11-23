"""
services/top_alerts_service.py - Every 30 min, picks the 5 most urgent or
negative stories for each leader's constituency and pushes + emails staff.
"""
import logging
import threading
import time
from datetime import date

from app.core.database import get_connection
from app.repositories import news_repository, user_repository
from app.services import notify_service
from app.services.push_service import send_share_push

logger = logging.getLogger(__name__)

_INTERVAL_SECONDS = 30 * 60
_started = False


def top5_for_constituency(constituency: str) -> list[dict]:
    if not constituency or constituency in ("All", "All Assembly Constituencies", "All Constituencies", "Statewide"):
        constituency = None
    articles = news_repository.fetch_articles(
        constituency=constituency, sentiment="negative", priority="P1", limit=5
    ) or []
    if not articles:
        articles = news_repository.fetch_articles(constituency=constituency, priority="P1", limit=5) or []
    if not articles:
        articles = news_repository.fetch_articles(constituency=constituency, sentiment="negative", limit=5) or []
    out = []
    for a in articles[:5]:
        out.append({
            "title": a.get("title") or a.get("headline") or "",
            "summary": a.get("summary") or "",
            "url": a.get("url") or "",
            "district": a.get("district_name") or "",
            "sentiment": a.get("sentiment") or "",
            "priority": a.get("priority") or "",
        })
    return out


def run_top_alerts() -> int:
    sent = 0
    today = date.today().isoformat()
    leaders = [l for l in user_repository.leaders_overview() if l["role"] in ("mla", "minister")]
    for leader in leaders:
        stories = top5_for_constituency(leader["constituency_name"])
        if not stories:
            continue
        staff = [s["username"] for s in user_repository.list_staff_of(leader["username"])]
        if not staff:
            continue
        lines = "\n".join(f"- {s['title']}" + (f" ({s['district']})" if s['district'] else "") for s in stories)
        body = (
            f"Top-5 alerts for {leader['constituency_name']} ({today})\n\n{lines}\n\n"
            "Open the app to read the full stories."
        )
        subject = f"Top alerts for {leader['constituency_name']}"
        for s in staff:
            try:
                notify_service.deliver("top_alerts", f"top5:{leader['username']}:{today}:{s}", s, subject, body)
            except Exception:
                logger.warning("top-alerts notify failed for %s", s, exc_info=True)
            sent += 1
        try:
            send_share_push(sender="Top alerts", title=f"{leader['constituency_name']}: urgent stories",
                            share_id=hash((leader["username"], today)) % 1000000, recipients=staff, urgent=True)
        except Exception:
            logger.warning("top-alerts push failed", exc_info=True)
    return sent


def start_scheduler() -> None:
    global _started
    if _started:
        return
    _started = True

    def loop() -> None:
        while True:
            try:
                run_top_alerts()
            except Exception:
                logger.warning("top-alerts scheduler error", exc_info=True)
            time.sleep(_INTERVAL_SECONDS)

    threading.Thread(target=loop, daemon=True, name="top-alerts").start()
