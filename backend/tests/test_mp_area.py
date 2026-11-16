"""
An MP's area (many constituencies) and the MP title (needs the throwaway Postgres; see test_shares.py).
The fixture comes from test_team_board: Sircilla has 2 stories, Gajwel has 2, Siddipet district is Gajwel's.
"""
import os

import pytest

if not os.getenv("ASO_TEST_DB"):
    pytest.skip("set ASO_TEST_DB=1 and DB_* to a throwaway database", allow_module_level=True)

import constituency_mappings
from app.core.database import get_connection
from app.core.security import hash_password
from test_team_board import PW, client, hdr  # noqa: F401


@pytest.fixture()
def area(client, monkeypatch):
    monkeypatch.setitem(constituency_mappings.AREAS, "Test Area", ["Sircilla", "Gajwel"])
    c = get_connection(); cur = c.cursor()
    h = hash_password(PW)
    cur.execute("DELETE FROM users WHERE username IN ('mp_t', 'mp_staff')")
    cur.execute("INSERT INTO users (username,password_hash,role,politician_name,constituency_name,district_name,leader_title,leader_party)"
                " VALUES ('mp_t',%s,'mla','MP T','Test Area','All','MP','BJP')", (h,))
    cur.execute("INSERT INTO users (username,password_hash,role,politician_name,constituency_name,district_name,mla_username)"
                " VALUES ('mp_staff',%s,'staff','','','','mp_t')", (h,))
    c.commit(); cur.close(); c.close()
    yield
    c = get_connection(); cur = c.cursor()
    cur.execute("DELETE FROM users WHERE username IN ('mp_t', 'mp_staff')"); c.commit(); cur.close(); c.close()


def titles(client, who, **q):
    r = client.get("/api/news", headers=hdr(client, who), params={"period": "all", "limit": 50, **q})
    assert r.status_code == 200, r.text
    return {a["headline"] for a in r.json()["articles"]}


def test_mp_sees_every_constituency_of_the_area(client, area):
    got = titles(client, "mp_t")
    assert {"Road repair begins in Sircilla", "Water shortage protest in Sircilla"} <= got      # member 1
    assert {"Hospital upgrade in Siddipet", "Farmers protest crop loss in Siddipet"} <= got     # member 2


def test_staff_inherit_the_area_and_a_normal_mla_still_sees_only_their_own(client, area):
    assert titles(client, "mp_staff") == titles(client, "mp_t")
    only = titles(client, "mla_s")
    assert "Hospital upgrade in Siddipet" not in only and "Road repair begins in Sircilla" in only


def test_title_and_party_come_with_me_and_staff_inherit_them(client, area):
    me = client.get("/api/me", headers=hdr(client, "mp_t")).json()["user"]
    assert me["leader_title"] == "MP" and me["leader_party"] == "BJP" and me["constituency_name"] == "Test Area"
    st = client.get("/api/me", headers=hdr(client, "mp_staff")).json()["user"]
    assert st["leader_title"] == "MP" and st["constituency_name"] == "Test Area"
    assert client.get("/api/me", headers=hdr(client, "mla_s")).json()["user"]["leader_title"] is None
    dash = client.get("/api/dashboard", headers=hdr(client, "mp_staff")).json()
    assert dash["leader"]["title"] == "MP" and dash["scope"]["label"] == "Test Area"
