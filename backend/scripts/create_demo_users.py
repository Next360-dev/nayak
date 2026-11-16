"""
Creates (or resets) DEMO accounts so every level can be tried: master admin, one MLA + 2 staff, one minister + 2 staff.
Passwords are random and saved to a private file OUTSIDE the repo (mode 600); they are never printed.
Only usernames starting with `demo_` are touched.   Run from backend/:
  python scripts/create_demo_users.py            create / reset the demo accounts
  python scripts/create_demo_users.py --remove   delete the demo accounts again
The demo MLA uses the real MLA name of Kothagudem so the MLA's news feed behaves like a real one.
"""
import os
import pathlib
import secrets
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_connection
from app.core.security import hash_password
from constituency_mappings import ALL_119_MLAS

CONSTITUENCY = "Kothagudem"
MLA = ALL_119_MLAS[CONSTITUENCY]

# username, role, display name, constituency, district, works_for, note
DEMOS = [
    ("demo_admin",           "admin",    "Demo Master Admin", "All", "All", None, "Master admin: control room, watches everything, shares nothing"),
    ("demo_mla",             "mla",      MLA["name"], CONSTITUENCY, MLA["district"], None, f"MLA of {CONSTITUENCY} (only that constituency's news)"),
    ("demo_mla_staff1",      "staff",    "", "", "", "demo_mla", "MLA's staff: shares up to demo_mla"),
    ("demo_mla_staff2",      "staff",    "", "", "", "demo_mla", "MLA's staff: shares up to demo_mla"),
    ("demo_minister",        "minister", "Demo Minister", "All", "All", None, "Minister (statewide news)"),
    ("demo_minister_staff1", "staff",    "", "", "", "demo_minister", "Minister's staff: shares up to demo_minister"),
    ("demo_minister_staff2", "staff",    "", "", "", "demo_minister", "Minister's staff: shares up to demo_minister"),
]
OUT = pathlib.Path(os.getenv("ASO_HOME", pathlib.Path.home() / ".config" / "ai-smart-office")) / "demo-logins.txt"


def main():
    conn = get_connection()
    cur = conn.cursor()
    if "--remove" in sys.argv:
        cur.execute("DELETE FROM users WHERE username LIKE 'demo\\_%' ESCAPE '\\'")
        conn.commit()
        print(f"Removed {cur.rowcount} demo accounts.")
        try:
            OUT.unlink()
        except FileNotFoundError:
            pass
        return

    lines = ["username | role | password | what it is", "-" * 70]
    for username, role, name, cons, dist, boss, note in DEMOS:
        pw = secrets.token_urlsafe(9)
        cur.execute(
            """INSERT INTO users (username, password_hash, role, politician_name, constituency_name, district_name, mla_username, is_active)
               VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE)
               ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
                 politician_name = EXCLUDED.politician_name, constituency_name = EXCLUDED.constituency_name,
                 district_name = EXCLUDED.district_name, mla_username = EXCLUDED.mla_username, is_active = TRUE""",
            (username, hash_password(pw), role, name, cons, dist, boss),
        )
        lines.append(f"{username} | {role} | {pw} | {note}")
    conn.commit()
    cur.close(); conn.close()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(OUT, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as fh:
        fh.write("\n".join(lines) + "\n")
    print(f"Created {len(DEMOS)} demo accounts. Logins saved to {OUT} (private file).")


if __name__ == "__main__":
    main()
