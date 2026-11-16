#!/usr/bin/env bash
# Run Nayak on THIS machine. Config + secrets live OUTSIDE the repo.
#   ./local.sh setup    first time: private DB container, tables, 119 MLAs, web build
#   ./local.sh admin    create/reset your admin login (hidden password prompt)
#   ./local.sh backup   save a copy of the database (keeps the last 14) in ~/ai-smart-office-backups
#   ./local.sh restore-check <file>   prove a backup restores (into a temporary database; touches nothing real)
#   ./local.sh restore <file> --yes   REPLACE the real database with a backup
#   ./local.sh contacts-sheet   make a CSV of all 119 MLAs with phone/email blank for you to fill
#   ./local.sh telugu-review export|import <file>   a sheet for a Telugu speaker to correct the wording
#   ./local.sh watchdog   check the app is alive; emails WATCHDOG_EMAIL_TO if it is down (run from cron, see docs/DEPLOY.md)
#   ./local.sh ollama-check [model]   is the local AI ready, and is it good at news tone? (never downloads anything)
#   ./local.sh email-setup   turn on email alerts + the morning briefing (asks 5 questions, sends a test)
#   ./local.sh email-test <address>   send one test email
#   ./local.sh test-ui  run the saved browser tests on a throwaway database (E2E_BROWSER=firefox for Firefox)
#   ./local.sh team --constituency <Name> --leader <user> --staff <user> [<user>...]   real MLA login + their staff (passwords go to a private file)
#   ./local.sh predeploy [../.env.production] [--db]   is it safe to put online? (PASS / WARN / FAIL, no secrets printed)
#   ./local.sh demo     make demo logins for every level (./local.sh demo --remove deletes them)
#   ./local.sh start    start the app  ->  http://127.0.0.1:8000
#   ./local.sh stop | status | logs
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
CFG="${ASO_HOME:-$HOME/.config/ai-smart-office}"
ENV_FILE="$CFG/local.env"
PIDFILE="$CFG/backend.pid"
LOG="$CFG/backend.log"
export ASO_ENV_FILE="$ENV_FILE"
PY="$ROOT/backend/venv/bin/python"

load_env() { set -a; . "$ENV_FILE"; set +a; }
need_env() { [ -f "$ENV_FILE" ] || { echo "Run ./local.sh setup first."; exit 1; }; }
running() { [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; }

case "${1:-}" in
  setup)
    mkdir -p "$CFG"; chmod 700 "$CFG"
    if [ ! -f "$ENV_FILE" ]; then
      umask 077
      {
        echo "DB_HOST=127.0.0.1"; echo "DB_PORT=${ASO_DB_PORT:-5440}"; echo "DB_NAME=ai_smart_office"; echo "DB_USER=aso"
        echo "DB_PASSWORD=$(python3 -c 'import secrets;print(secrets.token_urlsafe(24))')"
        echo "HOST=127.0.0.1"; echo "PORT=8000"
        echo "CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:8000,http://localhost:8000"
        echo "JWT_SECRET=$(python3 -c 'import secrets;print(secrets.token_urlsafe(48))')"
      } > "$ENV_FILE"
      echo "Created $ENV_FILE (private, outside the repo)."
    fi
    [ -x "$PY" ] || { echo "Creating Python environment..."; python3 -m venv "$ROOT/backend/venv"; }
    "$PY" -m pip install -q -r "$ROOT/backend/requirements.txt"
    echo "Starting the private database container..."
    ( cd "$ROOT" && docker compose -p ai-smart-office --env-file "$ENV_FILE" up -d db --wait )
    bash "$ROOT/backend/scripts/setup_release.sh"
    echo; echo "Next: ./local.sh admin   then   ./local.sh start"
    ;;
  admin)
    need_env; load_env; cd "$ROOT/backend"; shift; "$PY" scripts/create_admin.py "$@"
    ;;
  backup)
    need_env; load_env
    DIR="${ASO_BACKUPS:-$HOME/ai-smart-office-backups}"; mkdir -p "$DIR"; chmod 700 "$DIR"
    FILE="$DIR/aso-$(date +%Y%m%d-%H%M%S).dump"
    docker exec ai-smart-office-db-1 pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$FILE"
    [ -s "$FILE" ] || { rm -f "$FILE"; echo "Backup failed (empty file)."; exit 1; }
    ls -1t "$DIR"/aso-*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
    echo "Saved $FILE ($(du -h "$FILE" | cut -f1)). Keeping the newest 14."
    ;;
  restore-check)
    need_env; load_env; FILE="${2:-}"; [ -f "$FILE" ] || { echo "Usage: ./local.sh restore-check <backup file>"; exit 1; }
    TMPDB="${DB_NAME}_restorecheck"
    docker exec ai-smart-office-db-1 dropdb -U "$DB_USER" --if-exists "$TMPDB"
    docker exec ai-smart-office-db-1 createdb -U "$DB_USER" "$TMPDB"
    docker exec -i ai-smart-office-db-1 pg_restore -U "$DB_USER" -d "$TMPDB" --no-owner < "$FILE"
    q() { docker exec ai-smart-office-db-1 psql -U "$DB_USER" -d "$1" -At -c "$2"; }
    echo "Backup:  users=$(q "$TMPDB" 'SELECT count(*) FROM users'), stories=$(q "$TMPDB" 'SELECT count(*) FROM new_articles'), shares=$(q "$TMPDB" 'SELECT count(*) FROM shares')"
    echo "Live DB: users=$(q "$DB_NAME" 'SELECT count(*) FROM users'), stories=$(q "$DB_NAME" 'SELECT count(*) FROM new_articles'), shares=$(q "$DB_NAME" 'SELECT count(*) FROM shares')"
    docker exec ai-smart-office-db-1 dropdb -U "$DB_USER" "$TMPDB"
    echo "Restore check OK (temporary database removed)."
    ;;
  restore)
    need_env; load_env; FILE="${2:-}"; [ -f "$FILE" ] || { echo "Usage: ./local.sh restore <backup file> --yes"; exit 1; }
    [ "${3:-}" = "--yes" ] || { echo "This REPLACES the real database with the backup. Run again with --yes to confirm."; exit 1; }
    running && { kill "$(cat "$PIDFILE")"; rm -f "$PIDFILE"; }
    docker exec ai-smart-office-db-1 dropdb -U "$DB_USER" --if-exists "$DB_NAME"
    docker exec ai-smart-office-db-1 createdb -U "$DB_USER" "$DB_NAME"
    docker exec -i ai-smart-office-db-1 pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner < "$FILE"
    echo "Restored. Start the app with ./local.sh start"
    ;;
  test-ui)
    bash "$ROOT/e2e/run.sh"
    ;;
  contacts-sheet)
    need_env; load_env; ( cd "$ROOT/backend" && "$PY" scripts/export_contacts_sheet.py "${2:-$HOME/ai-smart-office-contacts.csv}" )
    ;;
  telugu-review)
    shift; python3 "$ROOT/scripts/telugu_review.py" "$@"
    ;;
  watchdog)
    need_env; load_env; ( cd "$ROOT/backend" && "$PY" scripts/watchdog.py )
    ;;
  ollama-check)
    need_env; load_env; ( cd "$ROOT/backend" && "$PY" scripts/ollama_check.py "${2:-}" )
    ;;
  email-setup)
    need_env; load_env
    [ -t 0 ] || { echo "Run this in a real terminal (it asks for a password):  ./local.sh email-setup"; exit 1; }
    read -rp "Mail server name (for Gmail: smtp.gmail.com): " H
    read -rp "Port [587]: " P; P="${P:-587}"
    read -rp "Username (usually your full email address): " U
    read -rsp "Password (for Gmail: an App Password; typing is hidden): " PW; echo
    read -rp "Send alerts FROM which address [$U]: " F; F="${F:-$U}"
    read -rp "Web address people use to open the app [http://127.0.0.1:8000]: " A; A="${A:-http://127.0.0.1:8000}"
    ENV_FILE="$ENV_FILE" SMTP_HOST="$H" SMTP_PORT="$P" SMTP_USER="$U" SMTP_PASSWORD="$PW" SMTP_FROM="$F" APP_BASE_URL="$A" \
      "$PY" "$ROOT/backend/scripts/set_smtp.py"
    read -rp "Send a test email to which address? [$F]: " T; T="${T:-$F}"
    load_env; ( cd "$ROOT/backend" && "$PY" scripts/email_test.py "$T" ) && echo "Now restart so the app uses it:  ./local.sh stop && ./local.sh start"
    ;;
  email-test)
    need_env; load_env; [ -n "${2:-}" ] || { echo "Usage: ./local.sh email-test you@example.com"; exit 1; }
    ( cd "$ROOT/backend" && "$PY" scripts/email_test.py "$2" )
    ;;
  demo)
    need_env; load_env; cd "$ROOT/backend"; shift; "$PY" scripts/create_demo_users.py "$@"
    ;;
  predeploy)
    need_env; load_env; cd "$ROOT/backend"; shift; "$PY" scripts/predeploy_check.py "$@"
    ;;
  team)
    need_env; load_env; cd "$ROOT/backend"; shift; "$PY" scripts/create_team.py "$@"
    ;;
  start)
    need_env; load_env
    running && { echo "Already running (pid $(cat "$PIDFILE"))."; exit 0; }
    ( cd "$ROOT" && docker compose -p ai-smart-office --env-file "$ENV_FILE" up -d db --wait ) >/dev/null
    cd "$ROOT/backend"
    "$PY" scripts/apply_migrations.py >/dev/null   # keeps the database current (safe to re-run)
    setsid nohup "$PY" -m app.main > "$LOG" 2>&1 &
    echo $! > "$PIDFILE"
    for _ in $(seq 1 20); do
      curl -fs "http://127.0.0.1:${PORT:-8000}/api/health" >/dev/null 2>&1 && { echo "Running: http://127.0.0.1:${PORT:-8000}"; exit 0; }
      sleep 1
    done
    echo "Did not come up. See: ./local.sh logs"; exit 1
    ;;
  stop)
    if running; then kill "$(cat "$PIDFILE")"; rm -f "$PIDFILE"; echo "Stopped."; else echo "Not running."; fi
    ;;
  status)
    need_env; load_env
    running && echo "backend: running (pid $(cat "$PIDFILE"))" || echo "backend: stopped"
    curl -s "http://127.0.0.1:${PORT:-8000}/api/health" 2>/dev/null || echo "health: not reachable"; echo
    ;;
  logs) tail -n 60 "$LOG" ;;
  *) echo "Usage: ./local.sh setup | admin | demo | team | predeploy | start | stop | status | logs | backup | restore-check | restore | test-ui | email-setup | email-test | contacts-sheet | telugu-review | watchdog"; exit 1 ;;
esac
