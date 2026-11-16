"""
repositories/user_repository.py
Dispatches user authentication and creation queries loaded from queries/users.sql.
"""

from app.core.database import get_connection
from app.queries import get_query

_SQL_FIND_USER = get_query("users.sql", "find_user_by_username")
_SQL_CREATE_USER = get_query("users.sql", "create_user")
_SQL_SET_PASSWORD = get_query("users.sql", "set_password")
_SQL_UPDATE_LAST_LOGIN = get_query("users.sql", "update_last_login")
_SQL_LEADERS_OVERVIEW = get_query("users.sql", "leaders_overview")
_SQL_LIST_STAFF_OF = get_query("users.sql", "list_staff_of")
_SQL_STAFF_EXISTS_FOR = get_query("users.sql", "staff_exists_for")
_SQL_SET_ACTIVE = get_query("users.sql", "set_active")
_SQL_LIST_ALL_USERS = get_query("users.sql", "list_all_users")
_SQL_USER_ROLE_ANY = get_query("users.sql", "user_role_any")
_SQL_CONTACT_OF = get_query("users.sql", "contact_of")
_SQL_SET_PROFILE = get_query("users.sql", "set_profile")
_SQL_ALERTABLE = get_query("users.sql", "list_alertable_users")

ROLES = ("admin", "mla", "minister", "staff")


def _row_to_user(row) -> dict:
    return {
        "username": row[0],
        "role": row[1],
        "politician_name": row[2] or row[0],
        "constituency_name": row[3] or "All",
        "district_name": row[4] or "All",
        "mla_username": row[6],
        "password_changed_at": row[8] if len(row) > 8 else None,
        "boss_role": row[7],
    }


def _run(sql: str, params: tuple = (), fetch: str | None = None, commit: bool = False):
    connection = get_connection()
    cursor = None
    try:
        cursor = connection.cursor()
        cursor.execute(sql, params)
        result = None
        if fetch == "one":
            result = cursor.fetchone()
        elif fetch == "all":
            result = cursor.fetchall()
        if commit:
            connection.commit()
        return result
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


def find_user_with_hash(username: str):
    """Returns (user_dict, password_hash) for an active user, else (None, None)."""
    row = _run(_SQL_FIND_USER, (username.strip().lower(),), fetch="one")
    if not row:
        return None, None
    return _row_to_user(row), row[5]


def find_user_by_username(username: str):
    """Returns the public user dict (no password hash) for an active user, else None."""
    user, _ = find_user_with_hash(username)
    return user


def create_user(username: str, password_hash: str, politician_name: str,
                constituency_name: str, district_name: str, role: str = "mla",
                mla_username: str | None = None):
    """Inserts a new user with an already-hashed password."""
    _run(
        _SQL_CREATE_USER,
        (username.strip().lower(), password_hash, role, politician_name,
         constituency_name, district_name,
         mla_username.strip().lower() if mla_username else None),
        commit=True,
    )
    return find_user_by_username(username)


def set_password_hash(username: str, password_hash: str) -> None:
    _run(_SQL_SET_PASSWORD, (password_hash, username.strip().lower()), commit=True)


def update_user_last_login(username: str) -> None:
    """Updates user last_login timestamp."""
    _run(_SQL_UPDATE_LAST_LOGIN, (username.strip().lower(),), commit=True)






def create_refresh_token(username: str, token_hash: str, expires_at) -> None:
    _run(
        "INSERT INTO refresh_tokens (username, token_hash, expires_at) VALUES (%s, %s, %s)",
        (username.strip().lower(), token_hash, expires_at),
        commit=True,
    )


def find_refresh_token(token_hash: str):
    """Returns (username, expires_at, revoked_at, replaced_by) or None."""
    row = _run(
        "SELECT username, expires_at, revoked_at, replaced_by FROM refresh_tokens WHERE token_hash = %s",
        (token_hash,), fetch="one",
    )
    if not row:
        return None
    return row[0], row[1], row[2], row[3]


def revoke_refresh_token(token_hash: str, replaced_by: str | None = None) -> None:
    _run(
        "UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()), replaced_by = COALESCE(%s, replaced_by) "
        "WHERE token_hash = %s",
        (replaced_by, token_hash), commit=True,
    )


def revoke_all_refresh_tokens(username: str) -> None:
    _run(
        "UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE LOWER(username) = %s AND revoked_at IS NULL",
        (username.strip().lower(),), commit=True,
    )


def count_device_tokens(username: str) -> int:
    row = _run(
        "SELECT COUNT(*) FROM device_tokens WHERE LOWER(username) = %s",
        (username.strip().lower(),), fetch="one",
    )
    return int(row[0]) if row else 0


def find_device_token_owner(token: str):
    """Returns the username that owns this token, or None."""
    row = _run(
        "SELECT username FROM device_tokens WHERE token = %s", (token,), fetch="one"
    )
    return row[0] if row else None


def register_device_token(username: str, token: str, platform: str = "unknown") -> None:
    _run(
        "INSERT INTO device_tokens (username, token, platform, updated_at) VALUES (%s, %s, %s, NOW()) "
        "ON CONFLICT (token) DO UPDATE SET username = EXCLUDED.username, "
        "platform = EXCLUDED.platform, updated_at = NOW()",
        (username.strip().lower(), token, platform or "unknown"),
        commit=True,
    )


def unregister_device_token(username: str, token: str) -> bool:
    conn = get_connection()
    cursor = None
    try:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM device_tokens WHERE token = %s AND LOWER(username) = %s",
            (token, username.strip().lower()),
        )
        deleted = cursor.rowcount
        conn.commit()
        return deleted > 0
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def list_device_tokens(username: str) -> list[str]:
    rows = _run(
        "SELECT token FROM device_tokens WHERE LOWER(username) = %s",
        (username.strip().lower(),), fetch="all",
    )
    return [r[0] for r in (rows or [])]


def delete_device_token(token: str) -> None:
    _run("DELETE FROM device_tokens WHERE token = %s", (token,), commit=True)




def _iso(v):
    return v.isoformat() if v else None


def leaders_overview() -> list[dict]:
    rows = _run(_SQL_LEADERS_OVERVIEW, fetch="all") or []
    return [
        {
            "username": r[0], "role": r[1], "politician_name": r[2], "constituency_name": r[3],
            "district_name": r[4], "last_login": _iso(r[5]), "staff_count": r[6],
            "shares": {"new": r[7], "seen": r[8], "acting": r[9], "done": r[10]},
            "oldest_unseen_share": _iso(r[11]), "last_share_action": _iso(r[12]),
        }
        for r in rows
    ]


def list_staff_of(boss_username: str) -> list[dict]:
    rows = _run(_SQL_LIST_STAFF_OF, (boss_username.strip().lower(),), fetch="all") or []
    return [{"username": r[0], "last_login": _iso(r[1]), "is_active": r[2]} for r in rows]


def is_staff_of(boss_username: str, staff_username: str) -> bool:
    """True if staff_username is a staff user (active or not) working for boss_username."""
    return bool(_run(_SQL_STAFF_EXISTS_FOR,
                     (boss_username.strip().lower(), staff_username.strip().lower()), fetch="one"))


def set_active(username: str, active: bool) -> None:
    _run(_SQL_SET_ACTIVE, (active, username.strip().lower()), commit=True)


def list_all_users() -> list[dict]:
    rows = _run(_SQL_LIST_ALL_USERS, fetch="all") or []
    return [
        {"username": r[0], "role": r[1], "politician_name": r[2], "constituency_name": r[3],
         "district_name": r[4], "works_for": r[5], "last_login": _iso(r[6]), "is_active": r[7]}
        for r in rows
    ]


def role_of_any(username: str) -> str | None:
    """Role of a user whether active or not, else None."""
    row = _run(_SQL_USER_ROLE_ANY, (username.strip().lower(),), fetch="one")
    return row[0] if row else None


def _contact(row) -> dict:
    return {"username": row[0], "role": row[1], "email": row[2], "phone": row[3],
            "alerts_enabled": row[4], "lang": row[5], "name": row[6] or row[0]}


def contact_of(username: str) -> dict | None:
    row = _run(_SQL_CONTACT_OF, (username.strip().lower(),), fetch="one")
    return _contact(row) if row else None


def set_profile(username: str, email: str | None, phone: str | None, alerts_enabled: bool, lang: str) -> None:
    _run(_SQL_SET_PROFILE, (email or None, phone or None, alerts_enabled, lang, username.strip().lower()), commit=True)


def list_alertable_users() -> list[dict]:
    """Active users who have an email address and have alerts switched on."""
    return [_contact(r) for r in (_run(_SQL_ALERTABLE, fetch="all") or [])]
