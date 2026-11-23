"""
services/watchlist_service.py - Staff pick up to 5 people per office; a job
crawls public posts for them every 30 min and alerts staff on new ones.
"""
import logging
import threading
import time
from datetime import datetime, timezone

from app.core.database import get_connection
from app.repositories import user_repository
from app.services import notify_service
from app.services.push_service import send_share_push
from social_media_scraper import scrape_social_media_for_mla, save_social_posts_to_db

logger = logging.getLogger(__name__)

_INTERVAL_SECONDS = 30 * 60
_started = False


def get_watchlist(leader_username: str) -> list[dict]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, notes, created_at FROM watchlist_names "
                "WHERE leader_username = %s ORDER BY created_at",
                (leader_username,),
            )
            rows = cur.fetchall() or []
    finally:
        conn.close()
    return [{"id": r[0], "name": r[1], "notes": r[2], "created_at": r[3].isoformat() if r[3] else None} for r in rows]


def get_watchlist_posts(leader_username: str) -> list[dict]:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT p.id, n.name, p.platform, p.headline, p.url, p.sent_at "
                "FROM watchlist_posts p JOIN watchlist_names n ON n.id = p.watchlist_id "
                "WHERE n.leader_username = %s ORDER BY p.sent_at DESC LIMIT 50",
                (leader_username,),
            )
            rows = cur.fetchall() or []
    finally:
        conn.close()
    return [
        {"id": r[0], "name": r[1], "platform": r[2], "headline": r[3], "url": r[4],
         "found_at": r[5].isoformat() if r[5] else None}
        for r in rows
    ]


def get_all_watchlist_activity() -> dict:
    """Return admin-visible watched names and their latest saved matches."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT n.id, n.name, n.leader_username, COALESCE(u.politician_name, u.username), "
                "u.constituency_name, p.post_id, p.platform, p.headline, p.url, p.sent_at "
                "FROM watchlist_names n JOIN users u ON u.username = n.leader_username "
                "LEFT JOIN watchlist_posts p ON p.watchlist_id = n.id "
                "ORDER BY p.sent_at DESC NULLS LAST, n.created_at DESC LIMIT 250"
            )
            rows = cur.fetchall() or []
    finally:
        conn.close()

    names_by_id = {}
    posts = []
    for row in rows:
        watch_id, name, leader_username, leader_name, constituency, post_id, platform, headline, url, sent_at = row
        names_by_id[watch_id] = {
            "id": watch_id, "name": name, "leader_username": leader_username,
            "leader_name": leader_name, "constituency_name": constituency,
        }
        if post_id:
            posts.append({
                "id": post_id, "name": name, "leader_username": leader_username,
                "leader_name": leader_name, "constituency_name": constituency,
                "platform": platform, "headline": headline, "url": url,
                "found_at": sent_at.isoformat() if sent_at else None,
            })
    return {"names": list(names_by_id.values()), "posts": posts[:100]}


def set_watchlist(leader_username: str, names: list[str]) -> None:
    names = list(dict.fromkeys(n.strip() for n in names if n.strip()))
    if len(names) > 5:
        raise ValueError("Watchlist is limited to 5 names per office")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name FROM watchlist_names WHERE leader_username = %s", (leader_username,))
            existing = cur.fetchall() or []
            requested = {name.casefold() for name in names}
            existing_by_name = {row[1].casefold(): row[0] for row in existing}
            removed_ids = [row[0] for row in existing if row[1].casefold() not in requested]
            if removed_ids:
                cur.execute("DELETE FROM watchlist_names WHERE id = ANY(%s)", (removed_ids,))
            for name in names:
                if name.casefold() in existing_by_name:
                    continue
                cur.execute(
                    "INSERT INTO watchlist_names (leader_username, name, created_at) VALUES (%s, %s, %s)",
                    (leader_username, name, datetime.now(timezone.utc)),
                )
            conn.commit()
    finally:
        conn.close()


def delete_watchlist(leader_username: str, watchlist_id: int) -> bool:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM watchlist_names WHERE id = %s AND leader_username = %s",
                (watchlist_id, leader_username),
            )
            removed = cur.rowcount
            conn.commit()
    finally:
        conn.close()
    return removed > 0


def check_watchlist_for_leader(leader_username: str) -> dict:
    """Run an immediate public-source scan for one office's watched names."""
    leader = next((l for l in user_repository.leaders_overview()
                   if l["username"] == leader_username and l["role"] in ("mla", "minister")), None)
    if not leader:
        raise ValueError("Could not find the leader linked to this office")

    entries = get_watchlist(leader_username)
    staff = [s["username"] for s in user_repository.list_staff_of(leader_username)]
    constituency = leader["constituency_name"] or "Telangana State"
    district = leader["district_name"]
    new_posts = []
    errors = []

    for entry in entries:
        try:
            scraped = scrape_social_media_for_mla(entry["name"], constituency, district)
            save_social_posts_to_db(scraped)
        except Exception as exc:
            logger.warning("watchlist crawl failed for %s (%s)", entry["name"], leader_username, exc_info=True)
            errors.append({"name": entry["name"], "message": str(exc)[:240] or "Public-source scan failed"})
            continue

        conn = get_connection()
        try:
            with conn.cursor() as cur:
                for post in scraped:
                    post_id = post.get("post_id")
                    if not post_id:
                        continue
                    cur.execute(
                        "INSERT INTO watchlist_posts (watchlist_id, post_id, platform, headline, url) "
                        "VALUES (%s, %s, %s, %s, %s) ON CONFLICT (watchlist_id, post_id) DO NOTHING "
                        "RETURNING post_id",
                        (entry["id"], post_id, post.get("platform"), (post.get("content") or "")[:120], post.get("url")),
                    )
                    if not cur.fetchone():
                        continue

                    headline = (post.get("content") or "")[:100]
                    new_posts.append({
                        "id": post_id, "name": entry["name"], "platform": post.get("platform"),
                        "headline": headline, "url": post.get("url"),
                    })
                    body = f"New public post from watched person \"{entry['name']}\" ({post.get('platform')}): {headline}\n{post.get('url') or ''}\n"
                    subject = f"Watchlist alert: {entry['name']} posted"
                    for staff_username in staff:
                        try:
                            notify_service.deliver("watchlist", f"wl:{entry['id']}:{post_id}:{staff_username}", staff_username, subject, body)
                        except Exception:
                            logger.warning("watchlist notify failed for %s", staff_username, exc_info=True)
                    if staff:
                        try:
                            send_share_push(sender="Watchlist", title=headline, share_id=entry["id"], recipients=staff, urgent=True)
                        except Exception:
                            logger.warning("watchlist push failed", exc_info=True)
                conn.commit()
        finally:
            conn.close()

    return {
        "checked_names": len(entries), "new_posts": new_posts, "errors": errors,
        "notification_count": len(new_posts) * len(staff),
    }


def crawl_watchlist() -> int:
    """Crawl public posts for every office watchlist and alert its staff."""
    sent = 0
    leaders = [l for l in user_repository.leaders_overview() if l["role"] in ("mla", "minister")]
    for leader in leaders:
        try:
            sent += check_watchlist_for_leader(leader["username"])["notification_count"]
        except Exception:
            logger.warning("watchlist scan failed for %s", leader["username"], exc_info=True)
    return sent


def start_scheduler() -> None:
    global _started
    if _started:
        return
    _started = True

    def loop() -> None:
        while True:
            try:
                crawl_watchlist()
            except Exception:
                logger.warning("watchlist scheduler error", exc_info=True)
            time.sleep(_INTERVAL_SECONDS)

    threading.Thread(target=loop, daemon=True, name="watchlist-crawler").start()


def run_once_for_test(leader_username: str) -> int:
    """Manual single crawl for a leader (tests/demo trigger)."""
    try:
        return check_watchlist_for_leader(leader_username)["notification_count"]
    except ValueError:
        return 0
