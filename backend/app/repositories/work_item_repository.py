"""
repositories/work_item_repository.py - letters & petitions with approval.

Scoped to one team: `team_leader` is the leader's lowercase username, so one team can
never read or touch another team's rows. Migration 010 enforces this inside the DB too.
"""
from datetime import date

import psycopg2.extras

from app.core.database import get_connection

ITEM_COLS = """
i.id, i.team_leader, i.kind, i.direction, i.title, i.body, i.reference_no, i.counterpart,
i.priority, i.due_date, i.status, i.created_by, i.assignee, i.decided_by, i.decided_at,
i.decision_note, i.created_at, i.updated_at,
COALESCE(NULLIF(u1.politician_name,''), u1.username) AS creator_name,
COALESCE(NULLIF(u2.politician_name,''), u2.username) AS assignee_name,
COALESCE(NULLIF(u3.politician_name,''), u3.username) AS leader_name
"""


def _iso(v):
    return v.isoformat() if v else None


def _item(r: dict) -> dict:
    return {
        "id": r["id"], "team_leader": r["team_leader"], "kind": r["kind"],
        "direction": r["direction"], "title": r["title"], "body": r["body"],
        "reference_no": r["reference_no"], "counterpart": r["counterpart"],
        "priority": r["priority"], "due_date": _iso(r["due_date"]), "status": r["status"],
        "created_by": r["created_by"], "assignee": r["assignee"],
        "decided_by": r["decided_by"], "decided_at": _iso(r["decided_at"]),
        "decision_note": r["decision_note"],
        "created_at": _iso(r["created_at"]), "updated_at": _iso(r["updated_at"]),
        "creator_name": r["creator_name"], "assignee_name": r["assignee_name"],
        "leader_name": r["leader_name"],
    }


def _event(r: dict) -> dict:
    return {
        "id": r["id"], "item_id": r["item_id"], "actor": r["actor"], "action": r["action"],
        "note": r["note"], "created_at": _iso(r["created_at"]),
    }


def _run(sql: str, params: tuple = (), fetch: str | None = None, commit: bool = False):
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, params)
        out = cur.fetchall() if fetch == "all" else cur.fetchone() if fetch == "one" else None
        if commit:
            conn.commit()
        cur.close()
        return out
    finally:
        conn.close()


def in_team(team_leader: str, who: str) -> bool:
    r = _run("SELECT in_team(%s, %s) AS ok", (team_leader, who), fetch="one")
    return bool(r["ok"]) if r else False


def _base_from(extra: str = "") -> str:
    return f"""FROM work_items i
        LEFT JOIN users u1 ON LOWER(u1.username) = LOWER(i.created_by)
        LEFT JOIN users u2 ON LOWER(u2.username) = LOWER(i.assignee)
        LEFT JOIN users u3 ON LOWER(u3.username) = LOWER(i.team_leader)
        {extra}"""


def create_item(team_leader: str, created_by: str, kind: str, direction: str, title: str,
                body: str | None, reference_no: str | None, counterpart: str | None,
                priority: str, due_date: date | None, assignee: str | None) -> dict:
    r = _run("""INSERT INTO work_items
        (team_leader, kind, direction, title, body, reference_no, counterpart, priority,
         due_date, created_by, assignee)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        RETURNING id""",
        (team_leader, kind, direction, title.strip(), body, reference_no, counterpart,
         priority, due_date, created_by.lower(), assignee.lower() if assignee else None),
        fetch="one", commit=True)
    item = get_item(team_leader, r["id"])
    add_event(r["id"], created_by.lower(), "created", f"Created {kind} '{title.strip()}'")
    return item


def get_item(team_leader: str, item_id: int) -> dict | None:
    r = _run(f"""SELECT {ITEM_COLS} {_base_from('WHERE i.id = %s AND i.team_leader = %s')}""",
             (item_id, team_leader), fetch="one")
    return _item(r) if r else None


def list_items(team_leader: str, me: str, status: str | None, kind: str | None,
               mine: bool, limit: int, offset: int) -> tuple[list[dict], int]:
    where = ["i.team_leader = %s"]
    params: list = [team_leader]
    if status:
        where.append("i.status = %s"); params.append(status)
    if kind:
        where.append("i.kind = %s"); params.append(kind)
    if mine:
        where.append("(LOWER(i.created_by) = LOWER(%s) OR LOWER(i.assignee) = LOWER(%s))")
        params += [me, me]
    where_sql = " AND ".join(where)
    total = _run(f"SELECT COUNT(*) AS c {_base_from('WHERE ' + where_sql)}",
                 tuple(params), fetch="one")["c"]
    rows = _run(f"""SELECT {ITEM_COLS} {_base_from('WHERE ' + where_sql)}
                    ORDER BY i.created_at DESC, i.id DESC
                    LIMIT %s OFFSET %s""",
                (*params, limit, offset), fetch="all") or []
    return [_item(r) for r in rows], total


def update_item(team_leader: str, item_id: int, fields: dict) -> dict | None:
    allowed = {k: v for k, v in fields.items() if k in
               ("title", "body", "reference_no", "counterpart", "priority", "due_date", "assignee")}
    if not allowed:
        return get_item(team_leader, item_id)
    values = {}
    for k, v in allowed.items():
        values[k] = v.lower() if k == "assignee" and v else v
    sets = ", ".join(f"{k} = %s" for k in values)
    params = [*values.values(), item_id, team_leader]
    _run(f"""UPDATE work_items SET {sets}, updated_at = NOW()
        WHERE id = %s AND team_leader = %s""", tuple(params), commit=True)
    return get_item(team_leader, item_id)


def submit_item(team_leader: str, item_id: int, actor: str, note: str | None) -> dict | None:
    _run("""UPDATE work_items SET status = 'submitted', updated_at = NOW()
        WHERE id = %s AND team_leader = %s AND status IN ('draft','changes_requested')""",
         (item_id, team_leader), commit=True)
    add_event(item_id, actor.lower(), "submitted", note)
    return get_item(team_leader, item_id)


def decide_item(team_leader: str, item_id: int, decider: str, decision: str,
                note: str | None) -> dict | None:
    status_map = {"approve": "approved", "reject": "rejected", "changes": "changes_requested"}
    new_status = status_map[decision]
    _run(f"""UPDATE work_items SET status = %s, decided_by = %s, decided_at = NOW(),
        decision_note = %s, updated_at = NOW()
        WHERE id = %s AND team_leader = %s AND status = 'submitted'""",
         (new_status, decider.lower(), note, item_id, team_leader), commit=True)
    add_event(item_id, decider.lower(), new_status, note)
    return get_item(team_leader, item_id)


def add_event(item_id: int, actor: str, action: str, note: str | None) -> dict:
    r = _run("""INSERT INTO work_item_events (item_id, actor, action, note)
        VALUES (%s,%s,%s,%s) RETURNING id, item_id, actor, action, note, created_at""",
        (item_id, actor.lower(), action, note), fetch="one", commit=True)
    return _event(r)


def events_for(item_id: int) -> list[dict]:
    rows = _run("""SELECT id, item_id, actor, action, note, created_at
        FROM work_item_events WHERE item_id = %s ORDER BY id""", (item_id,), fetch="all") or []
    return [_event(r) for r in rows]


def close_item(team_leader: str, item_id: int, actor: str, note: str | None) -> dict | None:
    _run("""UPDATE work_items SET status = 'closed', updated_at = NOW()
        WHERE id = %s AND team_leader = %s AND status IN ('approved','rejected')""",
         (item_id, team_leader), commit=True)
    add_event(item_id, actor.lower(), "closed", note)
    return get_item(team_leader, item_id)


def pending_count(team_leader: str) -> int:
    r = _run("SELECT COUNT(*) AS c FROM work_items WHERE team_leader = %s AND status = 'submitted'",
             (team_leader,), fetch="one")
    return r["c"]
