"""
repositories/politician_repository.py
Dispatches political representative & hierarchy queries loaded from queries/politicians.sql.
"""

from app.core.database import get_connection
from app.queries import get_query

_SQL_FETCH_DISTRICTS = get_query("politicians.sql", "fetch_districts")
_SQL_FETCH_CONSTITUENCIES = get_query("politicians.sql", "fetch_constituencies")
_SQL_FETCH_POLITICIANS_BASE = get_query("politicians.sql", "fetch_politicians_base")


def fetch_politicians(district: str | None = None, constituency: str | None = None):
    connection = get_connection()
    cursor = None
    try:
        cursor = connection.cursor()
        sql = _SQL_FETCH_POLITICIANS_BASE
        params = []
        if district and district != "All":
            sql += " AND district_name = %s"
            params.append(district)
        if constituency and constituency != "All":
            sql += " AND constituency_name = %s"
            params.append(constituency)
        sql += " ORDER BY name;"
        cursor.execute(sql, tuple(params))
        rows = cursor.fetchall()
        return [
            {
                "id": r[0], "name": r[1], "role_type": r[2],
                "party": r[3] or "Independent",
                "district_name": r[4], "constituency_name": r[5],
                "mandal_corporation": r[6],
                "contact_phone": r[7] or "+91 94401-98765",
                "email": r[8] or "office@telangana.gov.in",
            }
            for r in rows
        ]
    finally:
        if cursor: cursor.close()
        if connection: connection.close()


def fetch_hierarchy():
    connection = get_connection()
    cursor = None
    try:
        cursor = connection.cursor()
        cursor.execute(_SQL_FETCH_DISTRICTS)
        districts = [r[0] for r in cursor.fetchall()]

        cursor.execute(_SQL_FETCH_CONSTITUENCIES)
        constituencies = [r[0] for r in cursor.fetchall()]

        return {"districts": districts, "constituencies": constituencies}
    finally:
        if cursor: cursor.close()
        if connection: connection.close()
