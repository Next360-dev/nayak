"""
"Today" is a rolling 24 hours; the Archive is everything older (so they never overlap); the 48-hour preset is 24 to 48 hours old.
Needs the throwaway Postgres (see test_shares.py); the fixture comes from test_team_board.
"""
import json
import os

import pytest

if not os.getenv("ASO_TEST_DB"):
    pytest.skip("set ASO_TEST_DB=1 and DB_* to a throwaway database", allow_module_level=True)

from app.core.database import get_connection
from test_team_board import client, hdr  # noqa: F401

SRC = json.dumps([{"publisher": "Test Paper", "url": "https://example.com/t"}])
ROWS = [("TW fresh 2h", "2 hours"), ("TW late-night 30h", "30 hours"), ("TW two-days 60h", "60 hours"), ("TW old 5d", "5 days")]


@pytest.fixture()
def stories(client):
    c = get_connection(); cur = c.cursor()
    for title, age in ROWS:
        cur.execute("INSERT INTO new_articles (title,district,constituency,summary,sources,sentiment,constituencies,published_at) "
                    "VALUES (%s,'Rajanna Sircilla','Sircilla','Summary text.',%s,'positive',ARRAY['Sircilla'], NOW() - %s::interval)", (title, SRC, age))
    c.commit(); cur.close(); c.close()
    yield
    c = get_connection(); cur = c.cursor()
    cur.execute("DELETE FROM new_articles WHERE title LIKE 'TW %'"); c.commit(); cur.close(); c.close()


def got(client, **q):
    r = client.get("/api/news", headers=hdr(client, "mla_s"), params={"limit": 100, **q})
    assert r.status_code == 200, r.text
    return {a["headline"] for a in r.json()["articles"] if a["headline"].startswith("TW ")}


def test_today_is_the_last_24_hours_even_just_after_midnight(client, stories):
    assert got(client, period="today") == {"TW fresh 2h"}


def test_archive_is_everything_older_and_never_overlaps_today(client, stories):
    older = got(client, period="history")
    assert older == {"TW late-night 30h", "TW two-days 60h", "TW old 5d"}
    assert not (older & got(client, period="today"))


def test_archive_presets_cut_by_age(client, stories):
    assert got(client, period="history", date_range="48h") == {"TW late-night 30h"}                    # 24 to 48 hours old
    assert got(client, period="history", date_range="3d") == {"TW late-night 30h", "TW two-days 60h"}
    assert got(client, period="history", date_range="14d") == {"TW late-night 30h", "TW two-days 60h", "TW old 5d"}
