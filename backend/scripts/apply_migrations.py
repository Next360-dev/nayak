"""
Applies backend/migrations/*.sql in order (000, 001, 002, 003) using the DB_* settings from backend/.env.
All migrations are safe to run more than once. No psql needed.   Run from backend/:  python scripts/apply_migrations.py
"""
import os
import pathlib
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_connection

MIGRATIONS = pathlib.Path(__file__).resolve().parents[1] / "migrations"


def main():
    conn = get_connection()
    cur = conn.cursor()
    for f in sorted(MIGRATIONS.glob("*.sql")):
        print(f"  applying {f.name}")
        cur.execute(f.read_text())
        conn.commit()
    cur.close(); conn.close()
    print("Migrations done.")


if __name__ == "__main__":
    main()
