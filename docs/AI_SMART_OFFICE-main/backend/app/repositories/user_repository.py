"""
repositories/user_repository.py
Dispatches user authentication and creation queries loaded from queries/users.sql.
"""

from app.core.database import get_connection
from app.queries import get_query

_SQL_FIND_USER = get_query("users.sql", "find_user_by_username")
_SQL_CREATE_USER = get_query("users.sql", "create_user")
_SQL_UPDATE_LAST_LOGIN = get_query("users.sql", "update_last_login")



def find_user_by_username(username: str):
    """Returns user dict if found, else None."""
    connection = get_connection()
    cursor = None
    try:
        cursor = connection.cursor()
        cursor.execute(_SQL_FIND_USER, (username.lower(),))
        row = cursor.fetchone()
        if row:
            return {
                "username": row[0],
                "role": row[1],
                "politician_name": row[2] or row[0],
                "constituency_name": row[3] or "All",
                "district_name": row[4] or "All",
            }
        return None
    finally:
        if cursor: cursor.close()
        if connection: connection.close()


def create_user(username: str, password_raw: str, politician_name: str,
                constituency_name: str, district_name: str, role: str = "mla"):
    """Inserts a new user record."""
    connection = get_connection()
    cursor = None
    try:
        cursor = connection.cursor()
        cursor.execute(
            _SQL_CREATE_USER,
            (username.lower(), "scrypt:32768:8:1$default_hash", role,
             politician_name, constituency_name, district_name)
        )
        connection.commit()
        return {
            "username": username, "role": role,
            "politician_name": politician_name,
            "constituency_name": constituency_name,
            "district_name": district_name,
        }
    finally:
        if cursor: cursor.close()
        if connection: connection.close()


def update_user_last_login(user_id: int):
    """Updates user last_login timestamp."""
    connection = get_connection()
    cursor = None
    try:
        cursor = connection.cursor()
        cursor.execute(_SQL_UPDATE_LAST_LOGIN, (user_id,))
        connection.commit()
    finally:
        if cursor: cursor.close()
        if connection: connection.close()

