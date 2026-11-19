"""
Creates one leader login + 2 staff logins for every MLA (119) and every MP (17) in Telangana.
Reuses create_team.create_team() for the insert logic (same SQL, argon2 passwords, secrets.token_urlsafe(9)).
Skips any username that already exists - existing accounts are never touched.
Passwords are appended to the private file ~/.config/ai-smart-office/team-logins.txt (mode 600),
grouped by leader, and are never printed here - only a summary count.
Run from backend/:  python scripts/create_all_telangana_teams.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_connection
from create_team import create_team
from constituency_mappings import ALL_119_MLAS, AREAS


def slug(name):
    import re
    return re.sub(r'[^a-z0-9]+', '_', re.sub(r'^dr\.\s*', '', name, flags=re.I).lower()).strip('_')


def main():
    # Sanity: every MP seat's member constituencies must be exact ALL_119_MLAS keys.
    for seat, info in AREAS.items():
        for member in info["members"]:
            if member not in ALL_119_MLAS:
                sys.exit(f"'{member}' in area '{seat}' is not an ALL_119_MLAS key.")

    teams = []
    for constituency in sorted(ALL_119_MLAS):
        mla = ALL_119_MLAS[constituency]
        leader = slug(mla["name"])
        teams.append((leader, [leader + "_staff1", leader + "_staff2"], mla["name"], constituency, mla["district"], "MLA", mla["party"]))
    for seat in sorted(AREAS):
        info = AREAS[seat]
        leader = slug(info["mp"])
        teams.append((leader, [leader + "_staff1", leader + "_staff2"], info["mp"], seat, "All", "MP", info["party"]))

    conn = get_connection(); cur = conn.cursor()
    cur.execute("SELECT username FROM users WHERE is_active")
    existing = {r[0].lower() for r in cur.fetchall()}
    cur.close(); conn.close()

    created_leaders = created_staff = skipped = 0
    skipped_names = []
    for leader, staff, name, constituency, district, title, party in teams:
        if leader in existing:
            skipped += 1
            skipped_names.append(leader)
            continue
        created, was_skipped, _entries = create_team(leader, staff, name, constituency, district, leader_title=title, leader_party=party)
        if was_skipped or created == 0:
            skipped += 1
            skipped_names.append(leader)
        else:
            created_leaders += 1
            created_staff += created - 1

    total = created_leaders + created_staff
    skip = f"; skipped {skipped} already present: {', '.join(skipped_names)}" if skipped else ""
    print(f"Created {created_leaders} leader logins + {created_staff} staff logins, {total} total{skip}.")


if __name__ == "__main__":
    main()
