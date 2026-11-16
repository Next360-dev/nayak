"""
Makes a leader's screen about THEIR seat when it is bigger than one assembly constituency (an MP).
  python scripts/set_leader_area.py --leader etala_rajender --area "Malkajgiri Lok Sabha" --title MP --party BJP --name "Etala Rajender"
What it does (safe to run again):
  1. the leader's login gets the area, the title (MP) and the party; their staff inherit all of it;
  2. the leader's profile card (political_representatives) is created or updated, WITHOUT inventing contact details;
  3. stories already stored that name the leader (the aliases in constituency_mappings.LOCAL_POLITICIAN_ALIASES) are tagged to the area.
The areas themselves are defined in backend/constituency_mappings.py (AREAS).
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_connection
from constituency_mappings import AREAS, LOCAL_POLITICIAN_ALIASES, area_districts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--leader", required=True, help="the leader's username")
    ap.add_argument("--area", required=True, help="an area from constituency_mappings.AREAS")
    ap.add_argument("--title", required=True, help='how they are addressed, e.g. "MP"')
    ap.add_argument("--party", default=None)
    ap.add_argument("--name", required=True, help="their name as shown on screen")
    a = ap.parse_args()
    if a.area not in AREAS:
        sys.exit(f"'{a.area}' is not an area. Known: {', '.join(AREAS)}")

    conn = get_connection(); cur = conn.cursor()
    cur.execute("SELECT role FROM users WHERE LOWER(username) = %s AND is_active", (a.leader.lower(),))
    row = cur.fetchone()
    if not row or row[0] not in ("mla", "minister"):
        sys.exit(f"'{a.leader}' must be an active MLA or minister login.")

    cur.execute("UPDATE users SET constituency_name = %s, district_name = 'All', politician_name = %s, leader_title = %s, leader_party = %s "
                "WHERE LOWER(username) = %s", (a.area, a.name, a.title, a.party, a.leader.lower()))
    districts = ", ".join(area_districts(a.area))
    cur.execute("""INSERT INTO political_representatives (name, role_type, party, district_name, constituency_name)
                   VALUES (%s, %s, %s, %s, %s)
                   ON CONFLICT (name, constituency_name) DO UPDATE SET role_type = EXCLUDED.role_type, party = EXCLUDED.party, district_name = EXCLUDED.district_name""",
                (a.name, a.title, a.party, districts, a.area))
    aliases = [k.lower() for k, v in LOCAL_POLITICIAN_ALIASES.items() if v == a.area]
    retagged = 0
    for al in aliases:
        cur.execute("UPDATE new_articles SET constituency = %s, constituencies = ARRAY[%s], is_statewide = FALSE "
                    "WHERE LOWER(title) LIKE %s AND (constituency IS DISTINCT FROM %s)", (a.area, a.area, f"%{al}%", a.area))
        retagged += cur.rowcount
    cur.execute("INSERT INTO audit_log (actor, action, target, detail) VALUES ('set_leader_area.py', 'profile_updated', %s, %s::jsonb)",
                (a.leader.lower(), '{"area": "%s", "title": "%s"}' % (a.area, a.title)))
    conn.commit(); cur.close(); conn.close()
    print(f"{a.leader}: area '{a.area}', title {a.title}, party {a.party}; profile card saved; {retagged} stored stories tagged to the area.")


if __name__ == "__main__":
    main()
