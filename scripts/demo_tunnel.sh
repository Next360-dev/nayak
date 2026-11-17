#!/usr/bin/env bash
# Exposes the local backend (127.0.0.1:8000) to the internet via a fresh Cloudflare quick tunnel,
# points the deployed frontend at it, and pushes so Vercel redeploys. Run this on your PC whenever
# your partner is about to check the live demo (quick tunnels are not permanent and can drop).
set -euo pipefail
cd "$(dirname "$0")/.."

if ! curl -s -o /dev/null --max-time 3 http://127.0.0.1:8000/api/health; then
  echo "Backend is not responding on 127.0.0.1:8000. Start it first: ./local.sh start"
  exit 1
fi

echo "Stopping any old tunnel..."
pkill -f "cloudflared tunnel.*8000" 2>/dev/null || true
sleep 1

LOG=$(mktemp)
echo "Starting a fresh tunnel..."
nohup cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8000 > "$LOG" 2>&1 &
disown

URL=""
for i in $(seq 1 20); do
  URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' "$LOG" | head -1 || true)
  [ -n "$URL" ] && break
  sleep 1
done
if [ -z "$URL" ]; then
  echo "Tunnel did not come up in time. Log:"; cat "$LOG"; exit 1
fi

echo "Tunnel URL: $URL"
echo "Checking it actually reaches the backend..."
sleep 2
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$URL/api/health" || true)
if [ "$CODE" != "200" ]; then
  echo "Tunnel came up but /api/health returned '$CODE', not 200. Check the log: $LOG"
  exit 1
fi

VERCEL_JSON="frontend/vercel.json"
sed -i -E "s#https://[a-zA-Z0-9-]+\.trycloudflare\.com#$URL#" "$VERCEL_JSON"
echo "Updated $VERCEL_JSON"

git add "$VERCEL_JSON"
if git diff --cached --quiet; then
  echo "URL unchanged, nothing to push."
else
  git commit -m "Point frontend at a fresh demo tunnel"
  git push origin main
  echo "Pushed. Vercel will redeploy in about a minute."
fi

echo ""
echo "Demo is ready. Keep this terminal/PC on; closing it kills the tunnel."
echo "Backend: http://127.0.0.1:8000  |  Public: $URL"
