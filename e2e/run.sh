#!/usr/bin/env bash
# Runs the saved browser tests on a THROWAWAY database + server. Safe: never touches your real data.
#   ./local.sh test-ui        (or: bash e2e/run.sh)
# Needs: docker, Chrome, the backend venv, and Playwright for Node (set PLAYWRIGHT_MODULE / CHROME_BIN if yours differ).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="$ROOT/backend/venv/bin/python"
PGPORT="${E2E_DB_PORT:-55442}"; APPPORT="${E2E_APP_PORT:-8002}"; NAME="aso-e2e-pg"
export E2E_PASSWORD="e2e-pass-123"
export PLAYWRIGHT_MODULE="${PLAYWRIGHT_MODULE:-$(ls -d "$HOME"/.local/share/mise/installs/npm-playwright/latest/node_modules/playwright 2>/dev/null || echo playwright)}"
export CHROME_BIN="${CHROME_BIN:-/usr/bin/google-chrome-stable}"
export E2E_BROWSER="${E2E_BROWSER:-chromium}"
export E2E_BASE="http://127.0.0.1:$APPPORT"
APP_PID=""
cleanup() { [ -n "$APP_PID" ] && kill "$APP_PID" 2>/dev/null; docker stop "$NAME" >/dev/null 2>&1; }
trap cleanup EXIT

[ -d "$ROOT/frontend/dist" ] || ( cd "$ROOT/frontend" && npm run build --silent )
docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=e2e -e POSTGRES_DB=e2e -p "127.0.0.1:$PGPORT:5432" postgres:16-alpine >/dev/null || exit 2
export DB_HOST=127.0.0.1 DB_PORT="$PGPORT" DB_NAME=e2e DB_USER=postgres DB_PASSWORD=e2e
export JWT_SECRET="e2e-secret-e2e-secret-e2e-secret-e2e" SCRAPE_INITIAL_DELAY_SECONDS=999999 HOST=127.0.0.1 PORT="$APPPORT"
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 2
( cd "$ROOT/backend" && PYTHONPATH=. "$PY" "$ROOT/e2e/seed.py" ) || exit 2
( cd "$ROOT/backend" && exec "$PY" -m app.main ) >/tmp/aso-e2e-app.log 2>&1 &
APP_PID=$!
for _ in $(seq 1 30); do curl -fs "$E2E_BASE/api/health" >/dev/null 2>&1 && break; sleep 1; done
node "$ROOT/e2e/flows.cjs"
