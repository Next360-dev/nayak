"""
The database rejects forbidden shares even when the API is bypassed (needs a throwaway Postgres; see test_shares.py).
"""
import os
import pathlib

import pytest

if not os.getenv("ASO_TEST_DB"):
    pytest.skip("set ASO_TEST_DB=1 and DB_* to a throwaway database", allow_module_level=True)

import psycopg2

from app.core.database import get_connection
from app.core.security import hash_password

MIG = pathlib.Path(__file__).parents[1] / "migrations"


@pytest.fixture(scope="module")
def conn():
    c = get_connection(); cur = c.cursor()
    cur.execute("""DROP TABLE IF EXISTS share_replies, share_recipients, shares, users CASCADE;
      CREATE TABLE users (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, role TEXT NOT NULL,
        politician_name TEXT, constituency_name TEXT, district_name TEXT, last_login TIMESTAMPTZ);""")
    for f in ("001_auth_and_shares.sql", "004_share_pair_guard.sql"):
        cur.execute((MIG / f).read_text())
    cur.execute((MIG / "004_share_pair_guard.sql").read_text())   # re-runnable
    h = hash_password("correct-horse-1")
    for u, role, boss in [("admin", "admin", None), ("mla_a", "mla", None), ("mla_b", "mla", None),
                          ("min_x", "minister", None), ("staff_a", "staff", "mla_a"),
                          ("staff_b", "staff", "mla_b"), ("staff_m", "staff", "min_x")]:
        cur.execute("INSERT INTO users (username,password_hash,role,mla_username) VALUES (%s,%s,%s,%s)", (u, h, role, boss))
    c.commit(); yield c; c.close()


def try_share(conn, sender, recipient):
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO shares (sender, title) VALUES (%s, 't') RETURNING id", (sender,))
        sid = cur.fetchone()[0]
        cur.execute("INSERT INTO share_recipients (share_id, recipient) VALUES (%s, %s)", (sid, recipient))
        conn.commit()
        return True
    except psycopg2.errors.CheckViolation:
        conn.rollback()
        return False


@pytest.mark.parametrize("sender,recipient", [("staff_a", "mla_a"), ("staff_m", "min_x"),
                                              ("mla_a", "staff_a"), ("min_x", "staff_m")])
def test_allowed_pairs(conn, sender, recipient):
    assert try_share(conn, sender, recipient) is True


@pytest.mark.parametrize("sender,recipient", [
    ("admin", "mla_a"), ("admin", "staff_a"), ("mla_a", "admin"),      # admin never takes part
    ("staff_a", "mla_b"), ("staff_a", "min_x"), ("staff_a", "staff_b"), ("staff_a", "admin"),
    ("mla_a", "mla_b"), ("mla_a", "staff_b"), ("mla_a", "min_x"),      # leaders only reach their own staff
    ("min_x", "staff_a"), ("nobody", "mla_a"), ("staff_a", "nobody"),
])
def test_forbidden_pairs_are_rejected_by_the_database(conn, sender, recipient):
    assert try_share(conn, sender, recipient) is False
