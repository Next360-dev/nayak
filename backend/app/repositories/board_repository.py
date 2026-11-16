"""
repositories/board_repository.py - the team board (tasks + notes) and staff-edited briefings.

A "team" is keyed by the leader's lowercase username. Every query is scoped by it, so one team can never
read or touch another team's rows. Migration 007 also enforces this inside the database.
"""
from datetime import date

import psycopg2.extras

from app.core.database import get_connection

TASK_COLS = "id, team_leader, title, note, url, created_by, assigned_to, due_date, status, created_at, updated_at"


def _iso(v):
    return v.isoformat() if v else None


def _task(r: dict, notes: int = 0) -> dict:
    return {"id": r["id"], "title": r["title"], "note": r["note"], "url": r["url"], "created_by": r["created_by"],
            "assigned_to": r["assigned_to"], "due_date": _iso(r["due_date"]), "status": r["status"],
            "created_at": _iso(r["created_at"]), "updated_at": _iso(r["updated_at"]), "notes": notes}


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


def team_members(leader: str) -> list[str]:
    """The leader plus their ACTIVE staff (the people a task may be given to)."""
    rows = _run("SELECT username FROM users WHERE LOWER(username) = %s OR (role = 'staff' AND LOWER(mla_username) = %s AND is_active) "
                "ORDER BY (LOWER(username) = %s) DESC, username", (leader, leader, leader), fetch="all") or []
    return [r["username"].lower() for r in rows]


def list_tasks(leader: str, limit: int = 300) -> list[dict]:
    rows = _run(f"""SELECT {TASK_COLS}, (SELECT COUNT(*) FROM team_task_notes n WHERE n.task_id = t.id) AS note_count
                    FROM team_tasks t WHERE team_leader = %s
                    ORDER BY (status = 'done'), due_date NULLS LAST, id DESC LIMIT %s""", (leader, limit), fetch="all") or []
    return [_task(r, r["note_count"]) for r in rows]


def get_task(task_id: int, leader: str) -> dict | None:
    r = _run(f"SELECT {TASK_COLS} FROM team_tasks WHERE id = %s AND team_leader = %s", (task_id, leader), fetch="one")
    return _task(r) if r else None


def create_task(leader: str, created_by: str, title: str, note: str | None, url: str | None,
                assigned_to: str | None, due: date | None) -> int:
    r = _run("INSERT INTO team_tasks (team_leader, created_by, title, note, url, assigned_to, due_date) "
             "VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
             (leader, created_by, title, note, url, assigned_to, due), fetch="one", commit=True)
    return r["id"]


def update_task(task_id: int, leader: str, fields: dict) -> None:
    """`fields` holds only the columns to change: status, assigned_to, due_date (None clears the last two)."""
    allowed = {k: v for k, v in fields.items() if k in ("status", "assigned_to", "due_date", "title", "note")}
    if not allowed:
        return
    sets = ", ".join(f"{k} = %s" for k in allowed)
    _run(f"UPDATE team_tasks SET {sets} WHERE id = %s AND team_leader = %s", (*allowed.values(), task_id, leader), commit=True)


def notes_for(task_id: int) -> list[dict]:
    rows = _run("SELECT id, author, body, created_at FROM team_task_notes WHERE task_id = %s ORDER BY id", (task_id,), fetch="all") or []
    return [{"id": r["id"], "author": r["author"], "body": r["body"], "created_at": _iso(r["created_at"])} for r in rows]


def add_note(task_id: int, author: str, body: str) -> dict:
    r = _run("INSERT INTO team_task_notes (task_id, author, body) VALUES (%s, %s, %s) RETURNING id, author, body, created_at",
             (task_id, author, body), fetch="one", commit=True)
    return {"id": r["id"], "author": r["author"], "body": r["body"], "created_at": _iso(r["created_at"])}


def summary(leader: str, me: str, today: date) -> dict:
    """Small numbers for the home screens."""
    r = _run("""SELECT COUNT(*) FILTER (WHERE status = 'todo')  AS todo,
                       COUNT(*) FILTER (WHERE status = 'doing') AS doing,
                       COUNT(*) FILTER (WHERE status = 'done')  AS done,
                       COUNT(*) FILTER (WHERE status <> 'done' AND LOWER(assigned_to) = %s) AS mine,
                       COUNT(*) FILTER (WHERE status <> 'done' AND due_date < %s) AS overdue
                FROM team_tasks WHERE team_leader = %s""", (me, today, leader), fetch="one")
    return {"todo": r["todo"], "doing": r["doing"], "done": r["done"], "mine": r["mine"], "overdue": r["overdue"]}


# ── staff-edited briefing ─────────────────────────────────────────────────────
def get_briefing_edit(leader: str, lang: str, for_date: date) -> dict | None:
    r = _run("SELECT body, edited_by, updated_at FROM briefing_edits WHERE team_leader = %s AND lang = %s AND for_date = %s",
             (leader, lang, for_date), fetch="one")
    return {"body": r["body"], "edited_by": r["edited_by"], "updated_at": _iso(r["updated_at"])} if r else None


def save_briefing_edit(leader: str, lang: str, for_date: date, body: str, edited_by: str) -> None:
    _run("""INSERT INTO briefing_edits (team_leader, lang, for_date, body, edited_by) VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (team_leader, lang, for_date)
            DO UPDATE SET body = EXCLUDED.body, edited_by = EXCLUDED.edited_by, updated_at = NOW()""",
         (leader, lang, for_date, body, edited_by), commit=True)


def delete_briefing_edit(leader: str, lang: str, for_date: date) -> None:
    _run("DELETE FROM briefing_edits WHERE team_leader = %s AND lang = %s AND for_date = %s", (leader, lang, for_date), commit=True)
