"""
Creates (or resets) the first admin account. The password is typed at a hidden prompt, never stored in a file.
Run from backend/:  python scripts/create_admin.py [username]

No interactive terminal (for example inside a chat tool)? Use --generate: it makes a random password and saves it
to a private file (mode 600) OUTSIDE the repo, then tells you only the file's location:
  python scripts/create_admin.py admin --generate
"""
import getpass
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_connection
from app.core.security import MIN_PASSWORD_LENGTH, hash_password


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    generate = "--generate" in sys.argv
    if generate:
        import pathlib
        import secrets
        username = (args[0] if args else "admin").lower()
        pw = secrets.token_urlsafe(12)
        out = pathlib.Path(os.getenv("ASO_HOME", pathlib.Path.home() / ".config" / "ai-smart-office")) / "admin-login.txt"
        out.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(out, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w") as fh:
            fh.write(f"username: {username}\npassword: {pw}\n")
        print(f"Login saved to {out} (private file). Open it, log in, then change the password from Users > Reset a password.")
    else:
        if not sys.stdin.isatty():
            sys.exit("This needs a real terminal to type a hidden password. Open a terminal and run ./local.sh admin,\n"
                     "or run: ./local.sh admin --generate")
        username = (args[0] if args else input("Admin username [admin]: ").strip() or "admin").lower()
        pw = getpass.getpass(f"Password for {username} (min {MIN_PASSWORD_LENGTH} chars): ")
        if len(pw) < MIN_PASSWORD_LENGTH:
            sys.exit(f"Password must be at least {MIN_PASSWORD_LENGTH} characters.")
        if pw != getpass.getpass("Repeat password: "):
            sys.exit("Passwords did not match.")
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO users (username, password_hash, role, politician_name, constituency_name, district_name)
           VALUES (%s, %s, 'admin', 'Admin', 'All', 'All')
           ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', is_active = TRUE""",
        (username, hash_password(pw)),
    )
    conn.commit()
    cur.close(); conn.close()
    print(f"Admin '{username}' is ready.")


if __name__ == "__main__":
    main()
