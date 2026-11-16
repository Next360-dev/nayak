"""
Removes fabricated data from social_media_posts that older versions of the app wrote:

  1. Seeded posts: invented posts (fake authors, fake URLs, made-up events) about real MLAs.
     The only legitimate writer stores Google News links, so any row whose URL does not
     start with https://news.google.com/ is treated as seeded.
  2. Random engagement numbers on the remaining real rows are reset to NULL (unknown).

Run from backend/ ; it only REPORTS unless you pass --apply:
    python scripts/purge_fabricated_social_posts.py            # dry run
    python scripts/purge_fabricated_social_posts.py --apply    # delete + reset
Apply migration 002 first.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.database import get_connection  # noqa: E402

SEEDED = "NOT (COALESCE(url, '') LIKE 'https://news.google.com/%')"


def main(apply: bool) -> None:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) FROM social_media_posts WHERE {SEEDED}")
        seeded = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM social_media_posts")
        total = cur.fetchone()[0]
        print(f"Total posts: {total}. Looks seeded (not a Google News link): {seeded}. "
              f"Real rows with invented numbers: {total - seeded}.")
        cur.execute(f"SELECT platform, mla_name, LEFT(content, 70), url FROM social_media_posts "
                    f"WHERE {SEEDED} ORDER BY id LIMIT 8")
        for r in cur.fetchall():
            print("  sample seeded:", r)
        if not apply:
            print("Dry run only. Re-run with --apply to delete seeded rows and reset the numbers.")
            return
        cur.execute(f"DELETE FROM social_media_posts WHERE {SEEDED}")
        deleted = cur.rowcount
        cur.execute("UPDATE social_media_posts SET likes_count = NULL, shares_count = NULL, "
                    "comments_count = NULL, views_count = NULL")
        reset = cur.rowcount
        conn.commit()
        print(f"Deleted {deleted} seeded rows. Reset engagement to unknown on {reset} real rows.")
    finally:
        conn.close()


if __name__ == "__main__":
    main("--apply" in sys.argv)
