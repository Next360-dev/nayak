"""
Is this setup safe to put online? Prints PASS / WARN / FAIL lines and exits 1 if anything FAILS. Secrets are never printed.
  python scripts/predeploy_check.py ../.env.production          check the production settings file
  python scripts/predeploy_check.py ../.env.production --db      ...and also the live database (run inside the app container:
                                                                 docker compose --env-file .env.production -f docker-compose.prod.yml exec app python scripts/predeploy_check.py --db)
"""
import os
import pathlib
import shlex
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

WEAK = {"password", "postgres", "admin", "changeme", "123456", "secret", "test", "e2e"}
rows: list[tuple[str, str]] = []


def add(level: str, text: str) -> None:
    rows.append((level, text))


def read_env(path: str) -> dict:
    env = {}
    for line in pathlib.Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        try:
            parts = shlex.split(v)
        except ValueError:
            parts = [v]
        env[k.strip()] = parts[0] if parts else ""
    return env


def check_settings(env: dict) -> None:
    jwt = env.get("JWT_SECRET", "")
    add("PASS" if len(jwt) >= 32 and "CHANGE_ME" not in jwt else "FAIL", "JWT_SECRET is set, 32+ characters and not the placeholder")
    pw = env.get("DB_PASSWORD", "")
    add("PASS" if len(pw) >= 12 and pw.lower() not in WEAK and "CHANGE_ME" not in pw else "FAIL", "DB_PASSWORD is 12+ characters and not a placeholder or common word")
    add("PASS" if env.get("APP_ENV", "").lower() == "production" else "FAIL", "APP_ENV=production (makes the app refuse a weak JWT_SECRET)")
    base = env.get("APP_BASE_URL", "")
    add("PASS" if base.startswith("https://") else "FAIL", "APP_BASE_URL starts with https://")
    site = env.get("SITE_ADDRESS", "")
    add("PASS" if site and site not in ("localhost", "127.0.0.1") and "example." not in site else "WARN", "SITE_ADDRESS is your real domain (needed for the automatic HTTPS certificate)")
    add("PASS" if env.get("SMTP_HOST") and env.get("SMTP_FROM") else "WARN", "Email sender is set (SMTP_HOST + SMTP_FROM). Without it, alerts and the briefing email stay OFF")
    add("PASS" if env.get("TIMEZONE") else "WARN", "TIMEZONE is set (the briefing hour uses it)")
    add("PASS" if (pathlib.Path(__file__).resolve().parents[2] / "frontend" / "dist" / "index.html").exists() or os.path.exists("/app/frontend/dist/index.html") else "WARN", "The web app is built (frontend/dist)")


def check_database() -> None:
    from app.core.database import get_connection
    try:
        c = get_connection(); cur = c.cursor()
    except Exception as exc:
        add("FAIL", f"Cannot reach the database: {type(exc).__name__}")
        return
    cur.execute("SELECT COUNT(*) FROM users WHERE username LIKE 'demo\\_%' ESCAPE '\\'")
    n = cur.fetchone()[0]
    add("PASS" if n == 0 else "FAIL", f"No demo accounts left ({n} found)")
    cur.execute("SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active")
    add("PASS" if cur.fetchone()[0] >= 1 else "FAIL", "At least one active master admin exists")
    cur.execute("""SELECT l.username FROM users l WHERE l.role IN ('mla','minister') AND l.is_active
                   AND NOT EXISTS (SELECT 1 FROM users s WHERE s.role = 'staff' AND s.is_active AND LOWER(s.mla_username) = LOWER(l.username))""")
    lone = [r[0] for r in cur.fetchall()]
    add("PASS" if not lone else "WARN", "Every leader has at least one active staff login" + (f" (none for: {', '.join(lone)})" if lone else ""))
    cur.execute("SELECT COUNT(*) FROM new_articles")
    add("PASS" if cur.fetchone()[0] > 0 else "WARN", "The news engine has stored stories (it runs about 5 seconds after start, then every 3 hours)")
    cur.close(); c.close()


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    env = read_env(args[0]) if args else dict(os.environ)
    check_settings(env)
    if "--db" in sys.argv:
        check_database()
    icon = {"PASS": "PASS", "WARN": "WARN", "FAIL": "FAIL"}
    for level, text in rows:
        print(f"  {icon[level]}  {text}")
    fails = sum(1 for l, _ in rows if l == "FAIL"); warns = sum(1 for l, _ in rows if l == "WARN")
    print(f"\n{len(rows) - fails - warns} passed, {warns} warnings, {fails} failed")
    print("NOT ready: fix the FAIL lines." if fails else "Ready for a server." + (" (Warnings are optional but worth reading.)" if warns else ""))
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
