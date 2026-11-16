"""
repositories/share_repository.py
Dispatches share queries loaded from queries/shares.sql.
"""

from app.core.database import get_connection
from app.queries import get_query

Q = {name: get_query("shares.sql", name) for name in (
    "insert_share", "insert_recipient", "inbox", "unread_count", "sent_list",
    "recipients_for_shares", "get_share", "get_recipient_row", "update_status",
    "insert_reply", "replies_for",
)}


def _iso(v):
    return v.isoformat() if v else None


def _share_dict(r) -> dict:
    return {
        "id": r[0], "sender": r[1], "article_id": r[2], "title": r[3], "url": r[4],
        "summary": r[5], "district_name": r[6], "constituency_name": r[7],
        "note": r[8], "priority": r[9], "created_at": _iso(r[10]),
    }


def create_share(sender, article_id, title, url, summary, district_name,
                 constituency_name, note, priority, recipients: list[str]) -> int:
    """Inserts the share and all recipient rows in one transaction."""
    conn = get_connection()
    cur = None
    try:
        cur = conn.cursor()
        cur.execute(Q["insert_share"], (sender, article_id, title, url, summary,
                                        district_name, constituency_name, note, priority))
        share_id = cur.fetchone()[0]
        for rcpt in recipients:
            cur.execute(Q["insert_recipient"], (share_id, rcpt))
        conn.commit()
        return share_id
    except Exception:
        conn.rollback()
        raise
    finally:
        if cur: cur.close()
        conn.close()


def _query(sql, params, fetch="all", commit=False):
    conn = get_connection()
    cur = None
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        out = cur.fetchall() if fetch == "all" else (cur.fetchone() if fetch == "one" else None)
        if commit:
            conn.commit()
        return out
    finally:
        if cur: cur.close()
        conn.close()


def inbox(owner: str, limit: int = 100) -> list[dict]:
    rows = _query(Q["inbox"], (owner, limit))
    out = []
    for r in rows:
        d = _share_dict(r)
        d.update({"status": r[11], "seen_at": _iso(r[12]), "updated_at": _iso(r[13]),
                  "reply_count": r[14]})
        out.append(d)
    return out


def unread_count(owner: str) -> int:
    return _query(Q["unread_count"], (owner,), fetch="one")[0]


def sent(user: str, see_all: bool, limit: int = 100) -> list[dict]:
    shares = [_share_dict(r) for r in _query(Q["sent_list"], (see_all, user, limit))]
    if not shares:
        return shares
    ids = [s["id"] for s in shares]
    by_share: dict[int, list] = {i: [] for i in ids}
    for r in _query(Q["recipients_for_shares"], (ids,)):
        by_share[r[0]].append({"recipient": r[1], "status": r[2],
                               "seen_at": _iso(r[3]), "updated_at": _iso(r[4])})
    for s in shares:
        s["recipients"] = by_share[s["id"]]
    return shares


def get_share(share_id: int):
    r = _query(Q["get_share"], (share_id,), fetch="one")
    return _share_dict(r) if r else None


def get_recipient_row(share_id: int, recipient: str):
    r = _query(Q["get_recipient_row"], (share_id, recipient), fetch="one")
    return {"status": r[0], "seen_at": _iso(r[1]), "updated_at": _iso(r[2])} if r else None


def get_recipients(share_id: int) -> list[dict]:
    return [{"recipient": r[1], "status": r[2], "seen_at": _iso(r[3]), "updated_at": _iso(r[4])}
            for r in _query(Q["recipients_for_shares"], ([share_id],))]


def set_status(share_id: int, recipient: str, status: str) -> None:
    _query(Q["update_status"], (status, status, share_id, recipient), fetch=None, commit=True)


def add_reply(share_id: int, recipient: str, author: str, body: str) -> dict:
    r = _query(Q["insert_reply"], (share_id, recipient, author, body), fetch="one", commit=True)
    return {"id": r[0], "share_id": share_id, "recipient": recipient, "author": author,
            "body": body, "created_at": _iso(r[1])}


def replies(share_id: int, recipient: str | None) -> list[dict]:
    return [{"id": r[0], "recipient": r[1], "author": r[2], "body": r[3], "created_at": _iso(r[4])}
            for r in _query(Q["replies_for"], (share_id, recipient, recipient))]
