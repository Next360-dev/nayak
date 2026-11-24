"""
Store known leader portraits so the identity bar and Profile page show them.

  python scripts/seed_leader_photos.py            dry run: says what it would do
  python scripts/seed_leader_photos.py --apply    does it

Safe by design: it only fills a photo that is EMPTY (a photo the office set is never replaced), only fills empty
name/title, and leaves the portfolio UNPUBLISHED (the office publishes it themselves). Biographies and offices are never invented.
Add a leader by adding one line to LEADER_PHOTOS (username -> image link). Prefer a link on your own hosting.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import get_connection  # noqa: E402

LEADER_PHOTOS = {
    # Portrait hosted by the Venkatampalli Grama Panchayath official portal (the one the web app used before).
    "aadi_srinivas": "https://venkatampalligrampanchayat.com/assets/officials/Aadi-Srinivas.jpg",
}
TITLES = {"MLA": "Member of Legislative Assembly", "MP": "Member of Parliament", "Minister": "Minister"}


def main(apply: bool) -> None:
    conn = get_connection()
    try:
        cur = conn.cursor()
        for username, url in LEADER_PHOTOS.items():
            cur.execute("SELECT politician_name, leader_title FROM users WHERE username = %s AND role IN ('mla','minister')", (username,))
            user = cur.fetchone()
            if not user:
                print(f"skip {username}: no such leader")
                continue
            cur.execute("SELECT content FROM official_portfolios WHERE leader_username = %s", (username,))
            row = cur.fetchone()
            content = (row[0] if row and isinstance(row[0], dict) else (json.loads(row[0]) if row and row[0] else {})) or {}
            if content.get("avatar_url"):
                print(f"skip {username}: a photo is already saved ({content['avatar_url'][:50]}...)")
                continue
            content["avatar_url"] = url
            content.setdefault("full_name", user[0] or "")
            if not content.get("title_en") and user[1]:
                content["title_en"] = TITLES.get(user[1], user[1])
            print(f"{'set ' if apply else 'would set'} photo for {username}: {url}")
            if apply:
                cur.execute(
                    """INSERT INTO official_portfolios (leader_username, content, published, updated_by, updated_at)
                       VALUES (%s, %s::jsonb, FALSE, NULL, NOW())
                       ON CONFLICT (leader_username) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()""",
                    (username, json.dumps(content)),
                )
        if apply:
            conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    main("--apply" in sys.argv)
