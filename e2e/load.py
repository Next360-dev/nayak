"""
Simple load test: N simulated users log in once, then keep reading their dashboard / news / unread count for D seconds.
READ-ONLY (no writes), so it is safe against a real local app. Reports requests, errors and latency percentiles.
  backend/venv/bin/python e2e/load.py --users 50 --seconds 20 --creds ~/.config/ai-smart-office/demo-logins.txt
"""
import argparse
import asyncio
import os
import random
import statistics
import time

import httpx


async def user(i, base, creds, deadline, stats):
    name, pw = creds[i % len(creds)]
    async with httpx.AsyncClient(base_url=base, timeout=30) as c:
        r = await c.post("/api/login", json={"username": name, "password": pw})
        tok = r.json().get("token")
        if not tok:
            stats["errors"].append(("login", r.status_code)); return
        h = {"Authorization": f"Bearer {tok}"}
        calls = [("/api/dashboard", 4), ("/api/news?period=today&limit=20", 3), ("/api/shares/unread-count", 2), ("/api/me", 1)]
        paths = [p for p, w in calls for _ in range(w)]
        while time.time() < deadline:
            p = random.choice(paths)
            t = time.perf_counter()
            try:
                resp = await c.get(p, headers=h)
                ok = resp.status_code == 200
            except Exception as e:  # timeouts etc.
                ok = False; resp = None
            ms = (time.perf_counter() - t) * 1000
            stats["lat"].setdefault(p.split("?")[0], []).append(ms)
            if not ok:
                stats["errors"].append((p, resp.status_code if resp is not None else "exception"))
            await asyncio.sleep(random.uniform(0.3, 1.0))


def pct(v, q):
    v = sorted(v); return v[min(len(v) - 1, int(len(v) * q))]


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--users", type=int, default=50); ap.add_argument("--seconds", type=int, default=20)
    ap.add_argument("--base", default="http://127.0.0.1:8000"); ap.add_argument("--creds", required=True)
    a = ap.parse_args()
    creds = [(l.split(" | ")[0], l.split(" | ")[2]) for l in open(os.path.expanduser(a.creds)).read().splitlines()[2:] if " | " in l]
    stats = {"lat": {}, "errors": []}
    deadline = time.time() + a.seconds
    t0 = time.time()
    await asyncio.gather(*[user(i, a.base, creds, deadline, stats) for i in range(a.users)])
    total = sum(len(v) for v in stats["lat"].values()); dur = time.time() - t0
    print(f"{a.users} users, {dur:.0f}s: {total} requests ({total / dur:.0f}/s), {len(stats['errors'])} errors")
    for p, v in sorted(stats["lat"].items()):
        print(f"  {p:28} n={len(v):5}  p50={statistics.median(v):6.0f} ms  p95={pct(v, .95):6.0f} ms  p99={pct(v, .99):6.0f} ms  max={max(v):6.0f} ms")
    if stats["errors"]:
        print("  errors:", stats["errors"][:5])


asyncio.run(main())
