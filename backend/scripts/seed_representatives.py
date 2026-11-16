"""
Loads the 119 MLAs from backend/constituency_mappings.py into political_representatives.
Only name, party, district and constituency are known; phone/email stay NULL (shown as "not available").
Safe to run more than once. Run from backend/:  python scripts/seed_representatives.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_connection
from constituency_mappings import ALL_119_MLAS


def main():
    conn = get_connection()
    cur = conn.cursor()
    n = 0
    for constituency, m in ALL_119_MLAS.items():
        cur.execute(
            """INSERT INTO political_representatives (name, role_type, party, district_name, constituency_name)
               VALUES (%s, 'MLA', %s, %s, %s)
               ON CONFLICT (name, constituency_name) DO UPDATE
               SET party = EXCLUDED.party, district_name = EXCLUDED.district_name, role_type = EXCLUDED.role_type""",
            (m["name"], m.get("party"), m["district"], constituency),
        )
        n += 1
    conn.commit()
    cur.close(); conn.close()
    print(f"Loaded {n} MLAs into political_representatives.")


if __name__ == "__main__":
    main()
