"""
Builds a throwaway test database for the browser tests: runs every migration, then adds test users and a few
news rows clearly labelled [E2E]. NEVER point this at a real database (it drops tables).
Run from backend/ with DB_* pointing at the throwaway Postgres.
"""
import json
import os
import pathlib
import sys

sys.path.insert(0, os.getcwd())
from app.core.database import get_connection
from app.core.security import hash_password
import main_pipeline

PW = os.getenv("E2E_PASSWORD", "e2e-pass-123")
MIG = pathlib.Path("migrations")

c = get_connection(); cur = c.cursor()
cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
c.commit()
for f in sorted(MIG.glob("*.sql")):
    cur.execute(f.read_text())
c.commit(); cur.close(); c.close()
main_pipeline.ensure_schema()

c = get_connection(); cur = c.cursor()
h = hash_password(PW)
for u, role, pol, con, dist, boss in [
    ("admin", "admin", "Admin", "All", "All", None),
    ("mla_test", "mla", "[E2E] MLA", "Sircilla", "Rajanna Sircilla", None),
    ("mla2", "mla", "[E2E] MLA Two", "Mulugu", "Mulugu", None),
    ("min_test", "minister", "[E2E] Minister", "All", "All", None),
    ("staff_test", "staff", "", "", "", "mla_test"),
]:
    cur.execute("INSERT INTO users (username,password_hash,role,politician_name,constituency_name,district_name,mla_username) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s)", (u, h, role, pol, con, dist, boss))
for t, d, con, s, sw in [
    ("[E2E] Sircilla road repair work begins", "Rajanna Sircilla", "Sircilla", "positive", False),
    ("[E2E] Drinking water complaint in Sircilla ward", "Rajanna Sircilla", "Sircilla", "negative", False),
    ("[E2E] Statewide scheme announced", "Statewide", "Statewide", "positive", True),
    ("[E2E] Siddipet hospital upgrade", "Siddipet", "Gajwel", "positive", False),
]:
    cur.execute("INSERT INTO new_articles (title,district,constituency,summary,sources,sentiment,is_statewide,constituencies) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                (t, d, con, "[E2E] placeholder summary.", json.dumps([{"publisher": "E2E Paper", "url": "https://example.com/a"}]), s, sw, [con]))
cur.execute("INSERT INTO political_representatives (name, role_type, party, district_name, constituency_name) "
            "VALUES ('[E2E] Sircilla MLA', 'MLA', 'INC', 'Rajanna Sircilla', 'Sircilla')")
c.commit(); print("e2e database ready")
