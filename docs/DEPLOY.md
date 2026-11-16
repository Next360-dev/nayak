# Deployment guide (one server, tested on this machine 2026-11-15)

**Nothing is deployed yet.** This guide and the kit were proven on throwaway ports here: empty database, all 8 migrations,
HTTPS + security headers, first-run steps, logins, backup + restore, restart without data loss.
Deploying needs YOUR yes, a server and a domain (those cost money and are your choice).

## The plan: one small server runs everything
```
Internet ──► Caddy (HTTPS, ports 80/443) ──► app (web + API + news robot, no public port) ──► PostgreSQL (no public port)
```
Only Caddy is reachable from outside. The app and the database have no public port. Files in this kit:
| File | Job |
|---|---|
| `Dockerfile` | Builds the web app, then one Python image that serves web + API + the news robot |
| `docker-compose.prod.yml` | db + app + proxy, with health checks and restart policies |
| `deploy/Caddyfile` | The HTTPS front door (gets and renews the certificate by itself) |
| `.env.production.example` | Every setting, as placeholders. Copy to `.env.production` (git-ignored) |
| `backend/scripts/predeploy_check.py` | "Is this safe to put online?" (`./local.sh predeploy`) |

## What you provide
1. A Linux server with Docker and Docker Compose. A small one is a sensible start (about 2 GB RAM is my estimate, not measured).
2. A domain name with an **A record pointing at the server's IP** (needed for the automatic HTTPS certificate).
3. Ports **80 and 443** open on the server.
4. Optional: an email account for alerts (`docs/EMAIL_SETUP.md`, same settings go in `.env.production`).

## Steps on the server
```
git clone <your repo> && cd AI_SMART_OFFICE-main        # or copy the folder
cp .env.production.example .env.production
```
Fill `.env.production`. Make strong secrets with:
```
python3 -c "import secrets; print(secrets.token_urlsafe(48))"      # use one for JWT_SECRET, another for DB_PASSWORD
```
Set `SITE_ADDRESS` to your domain and `APP_BASE_URL=https://your-domain`. Then check it BEFORE starting:
```
python3 backend/scripts/predeploy_check.py .env.production
```
Every FAIL must be fixed (WARN lines are optional). Start it:
```
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```
First run only (the app creates the tables itself on every start):
```
D="docker compose --env-file .env.production -f docker-compose.prod.yml"
$D exec app python scripts/seed_representatives.py                 # loads the 119 MLAs
$D exec app python scripts/create_admin.py                         # your admin (hidden password prompt)
$D exec app python scripts/create_team.py --constituency Vemulawada --leader aadi_srinivas --staff aadi_staff1 aadi_staff2
$D exec app python scripts/predeploy_check.py --db                 # checks the live database too
```
`create_team.py` saves the random passwords in a private file INSIDE the app container
(`$D exec app cat /home/app/.config/ai-smart-office/team-logins.txt`). Copy them out safely, hand them over, and note they
live in the container volume only until it is rebuilt. Then open `https://your-domain`, log in as admin, and check the
Control Room. The first news arrives about 5 seconds after start, then every 3 hours.

## Updating later
```
git pull && docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```
Migrations run automatically and are safe to repeat. Run the tests first on your computer (below).

## Backups (do this before real users)
```
set -a; . ./.env.production; set +a                   # loads DB_USER / DB_NAME into this shell
D="docker compose --env-file .env.production -f docker-compose.prod.yml"
mkdir -p ~/backups
$D exec -T db pg_dump -U "$DB_USER" "$DB_NAME" | gzip > ~/backups/aso-$(date +%F).sql.gz        # one backup
```
Daily with cron (`crontab -e`), and **copy backups off the server too**:
`15 2 * * * cd /path/to/AI_SMART_OFFICE-main && set -a && . ./.env.production && set +a && docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db pg_dump -U $DB_USER $DB_NAME | gzip > ~/backups/aso-$(date +\%F).sql.gz`
Prove a backup restores (tested): create an empty database, load it, count users:
```
$D exec -T db psql -U "$DB_USER" -d postgres -c "CREATE DATABASE restore_proof"
gunzip -c ~/backups/aso-DATE.sql.gz | $D exec -T db psql -U "$DB_USER" -d restore_proof
$D exec -T db psql -U "$DB_USER" -d restore_proof -tAc "SELECT COUNT(*) FROM users"
```

## Watching it
- Point an uptime monitor at `https://your-domain/api/health` (`{"status":"ok","database":"up"}`, HTTP 503 if the database is down).
- `scripts/watchdog.py` (see `./local.sh watchdog`) emails you when the whole server is unreachable. Run it from ANOTHER machine's cron.
- Logs: `$D logs -f app`.

## Rules that must stay true
- **ONE app process only.** The news robot lives inside it. Never add `--workers` or `--reload` (the Dockerfile does it right).
- `APP_ENV=production` makes the app **refuse to start** with a missing or short `JWT_SECRET` (tested).
- Keep `.env.production` OUT of git and chat. Rotate `JWT_SECRET` only if you accept logging everyone out.
- The app trusts forwarded headers only because port 8000 is not public. Do not publish it (`ports:`) on the app service.
- Before each release: `cd frontend && npm run build`, backend tests (`pytest`, throwaway database), `./local.sh test-ui`,
  `pip-audit -r backend/requirements.txt`, `npm audit` (both were clean on 2026-11-14).

## Option B: web on Vercel, API on a server
Possible but not needed. The web app is static (`frontend/dist`) and Vercel can host it; the API, news robot and database must
stay on an always-on server (Vercel runs short on-demand functions, not long-running jobs). You would add a `vercel.json`
that forwards `/api/*` to the server, and set the security headers there. Ask for this only if you really want it.

## If something goes wrong
| Symptom | Likely cause and fix |
|---|---|
| No HTTPS certificate | The domain's DNS does not point at this server yet, or ports 80/443 are closed. `$D logs proxy` |
| App restarts again and again | `$D logs app`. Usually a short `JWT_SECRET` (needs 32+ characters) or a wrong DB setting |
| Everyone logged out after a restart | `JWT_SECRET` changed or was missing |
| Login says "Too many wrong attempts" | 5 wrong tries in 15 minutes; wait, or the admin resets the password |
| No emails | `SMTP_HOST` and `SMTP_FROM` not both set, or the person has no email in Contact & alerts |
| No news for hours | Control Room shows "news is stale"; `$D logs app`; admin can press "Run news update now" |

## Other pieces (unchanged)
Email alerts and briefing: `docs/EMAIL_SETUP.md`. Local AI for tone: `docs/LOCAL_AI.md`. Pilot plan: `docs/PILOT.md`.
Running locally without Docker for the app: `./local.sh setup | admin | start` (see README).
