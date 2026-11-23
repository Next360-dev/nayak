#!/usr/bin/env bash
# DEMO MODE. Run this on your PC when you need to show the live site (https://nayak-two.vercel.app).
#   ./scripts/demo_tunnel.sh          start everything (backend if needed, tunnel, point Vercel at it, push)
#   ./scripts/demo_tunnel.sh stop     stop the tunnel (your backend stays private again)
#
# What it does:
#   1. makes sure the backend is running on this PC
#   2. opens a Cloudflare quick tunnel to it (a NEW public address every time)
#   3. writes that address into frontend/vercel.json, commits, and pushes to BOTH GitHub repos
#   4. waits until the public site really reaches your backend
# Keep this PC on, online and the backend running for as long as the demo lasts.
set -euo pipefail
cd "$(dirname "$0")/.."

SITE="https://nayak-two.vercel.app"
LOG=$(mktemp)

if [ "${1:-}" = "stop" ]; then
  pkill -x cloudflared 2>/dev/null && echo "Tunnel stopped. The live site can no longer reach your backend." || echo "No tunnel was running."
  exit 0
fi

# 1. backend
if ! curl -s -o /dev/null --max-time 3 http://127.0.0.1:8000/api/health; then
  echo "Backend is not running. Starting it..."
  ./local.sh start
  sleep 3
fi
HEALTH=$(curl -s --max-time 5 http://127.0.0.1:8000/api/health || true)
case "$HEALTH" in *'"database":"up"'*) ;; *) echo "Backend answered '$HEALTH' (database not up). Start the database: docker start ai-smart-office-db-1"; exit 1;; esac

# 2. tunnel (exact process name, so this can never kill the wrong thing)
pkill -x cloudflared 2>/dev/null || true
sleep 1
echo "Starting a fresh tunnel..."
nohup cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8000 > "$LOG" 2>&1 &
disown
URL=""
for _ in $(seq 1 25); do
  URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' "$LOG" | head -1 || true)
  [ -n "$URL" ] && break
  sleep 1
done
[ -n "$URL" ] || { echo "Tunnel did not come up. Log: $LOG"; exit 1; }
echo "Tunnel address: $URL"

# Check the tunnel reaches the backend. This PC's own DNS is often slow to learn a brand-new address,
# so ask Cloudflare's DNS directly instead of trusting the local resolver.
HOST=${URL#https://}
OK=""
for _ in $(seq 1 15); do
  IP=$(curl -s --max-time 8 -H 'accept: application/dns-json' "https://cloudflare-dns.com/dns-query?name=$HOST&type=A" \
       | python3 -c "import sys,json; print((json.load(sys.stdin).get('Answer') or [{}])[0].get('data',''))" 2>/dev/null || true)
  if [ -n "$IP" ] && curl -s --max-time 10 --resolve "$HOST:443:$IP" "$URL/api/health" | grep -q '"status":"ok"'; then OK=1; break; fi
  sleep 3
done
[ -n "$OK" ] || { echo "The tunnel is up but /api/health did not answer through it. Log: $LOG"; exit 1; }
echo "Tunnel reaches your backend."

# 3. point Vercel at it, and push to both repos (Vercel watches Next360-dev/nayak)
sed -i -E "s#https://[a-zA-Z0-9-]+\.trycloudflare\.com#$URL#" frontend/vercel.json
git add frontend/vercel.json
if git diff --cached --quiet; then
  echo "vercel.json already has this address."
else
  git commit -q -m "Point frontend at a fresh demo tunnel"
fi
git push company main || { echo "Push to company failed. Check: gh auth status (Next360-dev must be logged in)"; exit 1; }
# the personal copy is a convenience; it must not stop the demo if it fails
T=$(gh auth token -u shivaganesh9515 2>/dev/null || true)
[ -n "$T" ] && GH_TOKEN="$T" git push origin main || echo "(Personal repo push skipped.)"

# 4. wait for Vercel to rebuild and the public site to reach the backend
echo "Waiting for Vercel to redeploy (about a minute)..."
for _ in $(seq 1 40); do
  if curl -s --max-time 10 "$SITE/api/health" | grep -q '"status":"ok"'; then
    echo ""
    echo "READY. Share this: $SITE"
    echo "Keep this PC on. To stop sharing:  ./scripts/demo_tunnel.sh stop"
    exit 0
  fi
  sleep 5
done
echo "The site did not reach the backend within about 3 minutes. Check the Vercel deployment: https://vercel.com/next361/nayak"
exit 1
