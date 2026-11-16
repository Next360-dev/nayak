#!/usr/bin/env bash
# One-shot setup from NOTHING to a working app. YOU run this (it needs your database).
#   1. cp backend/.env.example backend/.env   and fill DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD
#   2. No database yet?  docker compose --env-file backend/.env up -d db     (from the repo root)
#   3. bash backend/scripts/setup_release.sh
# Never prints secrets. Never deletes data (the fake-row purge is a dry run only).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ASO_ENV_FILE:-$ROOT/backend/.env}"

[ -f "$ENV_FILE" ] || { echo "Missing backend/.env. Copy backend/.env.example and fill in the DB_* values first."; exit 1; }
set -a; . "$ENV_FILE"; set +a
for v in DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD; do
  [ -n "${!v:-}" ] || { echo "$v is empty in backend/.env"; exit 1; }
done

cd "$ROOT/backend"
PY=python3; [ -x venv/bin/python ] && PY=venv/bin/python

echo "1/7 Python dependencies"
$PY -m pip install -q -r requirements.txt

echo "2/7 JWT_SECRET"
if grep -qE '^JWT_SECRET=.+' "$ENV_FILE"; then
  echo "    already set, leaving it alone"
else
  SECRET="$($PY -c 'import secrets; print(secrets.token_urlsafe(48))')"
  sed -i '/^JWT_SECRET=/d' "$ENV_FILE"
  printf '\nJWT_SECRET=%s\n' "$SECRET" >> "$ENV_FILE"
  echo "    generated and saved to backend/.env (not shown)"
fi

echo "3/7 Can we reach the database?"
if ! $PY -c "from app.core.database import get_connection; get_connection().close()" 2>/dev/null; then
  echo "    No. Start one with:  docker compose --env-file backend/.env up -d db   (then re-run this script)"
  exit 1
fi
echo "    yes"

echo "4/7 Tables (migrations, safe to re-run)"
$PY scripts/apply_migrations.py

echo "5/7 The 119 MLAs"
$PY scripts/seed_representatives.py

echo "6/7 Fake social rows: DRY RUN (nothing deleted)"
$PY scripts/purge_fabricated_social_posts.py || true

echo "7/7 Web build"
( cd "$ROOT/frontend" && npm ci --silent && npm run build --silent )

cat <<MSG

Done. Next:
  - Create your admin login (hidden password prompt):  cd backend && $PY scripts/create_admin.py
  - Start the backend:   cd backend && $PY -m app.main
  - Check:               curl http://127.0.0.1:${PORT:-8000}/api/health
  - The first news appears ~5 seconds after the backend starts (about 2 minutes to finish).
MSG
