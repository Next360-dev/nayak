from app.core.database import get_connection
from psycopg2.extras import Json


def get_portfolio(leader_username: str) -> dict | None:
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT content, published, updated_by, updated_at FROM official_portfolios WHERE leader_username = %s",
                (leader_username.lower(),),
            )
            row = cursor.fetchone()
            if not row:
                return None
            content = row[0] if isinstance(row[0], dict) else {}
            return {"content": content, "published": row[1], "updated_by": row[2], "updated_at": row[3].isoformat() if row[3] else None}
    finally:
        connection.close()


def save_portfolio(leader_username: str, updated_by: str, content: dict) -> dict:
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """INSERT INTO official_portfolios (leader_username, content, published, updated_by, updated_at)
                   VALUES (%s, %s, TRUE, %s, NOW())
                   ON CONFLICT (leader_username) DO UPDATE SET content = EXCLUDED.content,
                     published = TRUE, updated_by = EXCLUDED.updated_by, updated_at = NOW()
                   RETURNING content, published, updated_by, updated_at""",
                (leader_username.lower(), Json(content), updated_by.lower()),
            )
            row = cursor.fetchone()
        connection.commit()
        return {"content": row[0] if isinstance(row[0], dict) else content, "published": row[1], "updated_by": row[2], "updated_at": row[3].isoformat() if row[3] else None}
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
