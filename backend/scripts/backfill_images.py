"""
One-off: give stories already in the database a picture by reading each publisher page's og:image.
Only stories from the last N days without a picture, publisher links only (Google News links cannot be read). Safe to re-run.
Run from backend/:  python scripts/backfill_images.py [--days 3] [--max 600]
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from psycopg2.extras import Json

from app.core.database import get_connection
from image_utils import enrich_clusters


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=3)
    ap.add_argument("--max", type=int, default=600)
    a = ap.parse_args()
    conn = get_connection(); cur = conn.cursor()
    cur.execute("SELECT id, sources FROM new_articles WHERE created_at > NOW() - (%s || ' days')::interval ORDER BY created_at DESC", (str(a.days),))
    rows = [{"id": r[0], "sources": r[1] or []} for r in cur.fetchall()]
    found = enrich_clusters(rows, max_fetch=a.max)
    for r in rows:
        if any(isinstance(s, dict) and s.get("image_url") for s in r["sources"]):
            cur.execute("UPDATE new_articles SET sources = %s WHERE id = %s", (Json(r["sources"]), r["id"]))
    conn.commit(); cur.close(); conn.close()
    print(f"Looked at {len(rows)} stories, found pictures for {found}.")


if __name__ == "__main__":
    main()
