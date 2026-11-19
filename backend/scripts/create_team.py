"""
Creates one real MLA login plus their staff logins, all linked so the staff work ONLY for that MLA.
Passwords are random and saved to a private file OUTSIDE the repo (mode 600); they are never printed.
Existing usernames are never touched (use the Users screen to reset a password).   Run from backend/:
  python scripts/create_team.py --constituency Vemulawada --leader aadi_srinivas --staff aadi_staff1 aadi_staff2
The MLA's name, party area and district come from the 119-MLA list, so the MLA's news feed is tied to the right person.
create_team() is reused by scripts/create_all_telangana_teams.py for the 119 MLAs + 17 MPs.
"""
import argparse
import os
import pathlib
import re
import secrets
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_connection
from app.core.security import hash_password
from app.services import auth_service
from constituency_mappings import ALL_119_MLAS

OUT = pathlib.Path(os.getenv("ASO_HOME", pathlib.Path.home() / ".config" / "ai-smart-office")) / "team-logins.txt"


def slug(name):
    """Lowercase, underscore-separated username from a real name (e.g. Aadi Srinivas -> aadi_srinivas)."""
    return re.sub(r'[^a-z0-9]+', '_', re.sub(r'^dr\.\s*', '', name, flags=re.I).lower()).strip('_')


def create_team(leader, staff, name, constituency, district, leader_title=None, leader_party=None):
    """Insert one leader + their staff users. Skips entirely if any username already exists.

    Returns (created, skipped, entries): created = number of rows inserted (3 on success, 0 on skip),
    skipped = True when nothing was created, entries = [(username, password, role), ...]
    Passwords are written to the private file OUT and never returned/printed here.
    """
    names = [leader.strip().lower()] + [s.strip().lower() for s in staff]
    if len(set(names)) != len(names):
        raise ValueError("Usernames must all be different.")

    conn = get_connection(); cur = conn.cursor()
    cur.execute("SELECT username FROM users WHERE LOWER(username) = ANY(%s)", (names,))
    taken = [r[0] for r in cur.fetchall()]
    if taken:
        cur.close(); conn.close()
        return 0, True, []
    for n in names:                                                           # same rules the app applies (length, characters)
        err = auth_service.validate_new_user(n, "x" * 12, "mla", None)   # username rules only; the staff link is made below
        if err and "assword" not in err:
            cur.close(); conn.close()
            raise ValueError(f"{n}: {err}")

    mla = ALL_119_MLAS.get(constituency)
    district = mla["district"] if mla else district
    display_name = name or (mla["name"] if mla else constituency)
    lines = [f"{leader_title or 'MLA'}: {display_name} ({constituency}, {district})", "username | role | password", "-" * 50]
    rows = [(names[0], "mla", display_name, constituency, district, None, leader_title, leader_party)] + [(n, "staff", "", "", "", names[0], None, None) for n in names[1:]]
    entries = []
    for username, role, pol, cons, dist, boss, title, party in rows:
        pw = secrets.token_urlsafe(9)
        cur.execute("INSERT INTO users (username, password_hash, role, politician_name, constituency_name, district_name, mla_username, leader_title, leader_party, must_change_password, is_active) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE, TRUE)", (username, hash_password(pw), role, pol, cons, dist, boss, title, party))
        cur.execute("INSERT INTO audit_log (actor, action, target, detail) VALUES ('create_team.py', 'user_created', %s, %s::jsonb)",
                    (username, '{"role": "%s"}' % role))
        entries.append((username, pw, role))
        lines.append(f"{username} | {role} | {pw}")
    conn.commit(); cur.close(); conn.close()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    mode = "a" if OUT.exists() else "w"
    fd = os.open(OUT, os.O_WRONLY | os.O_CREAT | (os.O_APPEND if mode == "a" else os.O_TRUNC), 0o600)
    with os.fdopen(fd, mode) as fh:
        fh.write(("\n" if mode == "a" else "") + "\n".join(lines) + "\n")
    return len(rows), False, entries


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--constituency", required=True, help="exact constituency name, e.g. Vemulawada")
    ap.add_argument("--leader", required=True, help="username for the MLA")
    ap.add_argument("--staff", nargs="+", required=True, help="usernames for their staff")
    ap.add_argument("--name", help="show this name instead of the list's MLA name (e.g. an MP whose area is this constituency)")
    ap.add_argument("--title", default=None, help="how the leader is addressed, e.g. MP")
    ap.add_argument("--party", default=None, help="leader's party")
    a = ap.parse_args()

    mla = ALL_119_MLAS.get(a.constituency)
    if not mla:
        sys.exit(f"'{a.constituency}' is not in the 119-constituency list. Check the spelling.")
    created, skipped, entries = create_team(a.leader, a.staff, a.name, a.constituency, mla["district"], a.title, a.party)
    if skipped:
        sys.exit("Already exist (nothing was created).")
    print(f"Created {created} logins for {entries[0][0] if entries else a.leader}. Passwords saved to {OUT} (private file).")


if __name__ == "__main__":
    main()
