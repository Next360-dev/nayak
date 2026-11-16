"""
Creates one real MLA login plus their staff logins, all linked so the staff work ONLY for that MLA.
Passwords are random and saved to a private file OUTSIDE the repo (mode 600); they are never printed.
Existing usernames are never touched (use the Users screen to reset a password).   Run from backend/:
  python scripts/create_team.py --constituency Vemulawada --leader aadi_srinivas --staff aadi_staff1 aadi_staff2
The MLA's name, party area and district come from the 119-MLA list, so the MLA's news feed is tied to the right person.
"""
import argparse
import os
import pathlib
import secrets
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_connection
from app.core.security import hash_password
from app.services import auth_service
from constituency_mappings import ALL_119_MLAS

OUT = pathlib.Path(os.getenv("ASO_HOME", pathlib.Path.home() / ".config" / "ai-smart-office")) / "team-logins.txt"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--constituency", required=True, help="exact constituency name, e.g. Vemulawada")
    ap.add_argument("--leader", required=True, help="username for the MLA")
    ap.add_argument("--staff", nargs="+", required=True, help="usernames for their staff")
    ap.add_argument("--name", help="show this name instead of the list's MLA name (e.g. an MP whose area is this constituency)")
    a = ap.parse_args()

    mla = ALL_119_MLAS.get(a.constituency)
    if not mla:
        sys.exit(f"'{a.constituency}' is not in the 119-constituency list. Check the spelling.")
    names = [a.leader.strip().lower()] + [s.strip().lower() for s in a.staff]
    if len(set(names)) != len(names):
        sys.exit("Usernames must all be different.")

    conn = get_connection(); cur = conn.cursor()
    cur.execute("SELECT username FROM users WHERE LOWER(username) = ANY(%s)", (names,))
    taken = [r[0] for r in cur.fetchall()]
    if taken:
        sys.exit(f"Already exist (nothing was created): {', '.join(taken)}")
    for n in names:                                                           # same rules the app applies (length, characters)
        err = auth_service.validate_new_user(n, "x" * 12, "mla", None)   # username rules only; the staff link is made below
        if err and "assword" not in err:
            sys.exit(f"{n}: {err}")

    mla = {**mla, "name": a.name or mla["name"]}
    lines = [f"MLA: {mla['name']} ({a.constituency}, {mla['district']})", "username | role | password", "-" * 50]
    rows = [(names[0], "mla", mla["name"], a.constituency, mla["district"], None)] + [(n, "staff", "", "", "", names[0]) for n in names[1:]]
    for username, role, pol, cons, dist, boss in rows:
        pw = secrets.token_urlsafe(9)
        cur.execute("INSERT INTO users (username, password_hash, role, politician_name, constituency_name, district_name, mla_username, is_active) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE)", (username, hash_password(pw), role, pol, cons, dist, boss))
        cur.execute("INSERT INTO audit_log (actor, action, target, detail) VALUES ('create_team.py', 'user_created', %s, %s::jsonb)",
                    (username, '{"role": "%s"}' % role))
        lines.append(f"{username} | {role} | {pw}")
    conn.commit(); cur.close(); conn.close()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    mode = "a" if OUT.exists() else "w"
    fd = os.open(OUT, os.O_WRONLY | os.O_CREAT | (os.O_APPEND if mode == "a" else os.O_TRUNC), 0o600)
    with os.fdopen(fd, mode) as fh:
        fh.write(("\n" if mode == "a" else "") + "\n".join(lines) + "\n")
    print(f"Created {len(rows)} logins for {mla['name']}. Passwords saved to {OUT} (private file).")


if __name__ == "__main__":
    main()
