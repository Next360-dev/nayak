"""
scripts/update_summaries.py
Quick updater script to upgrade existing articles in PostgreSQL with natural, clean AI summaries.
Adapts naturally to the depth of the news without forcing rigid line counts.
"""

import sys
import os

# Enable UTF-8 console output on Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)


from app.core.database import get_connection
from gemini_summary_service import generate_natural_summary, smart_natural_fallback


def run_quick_summary_updater(limit: int = 40):
    print(f"=== STARTING NATURAL SUMMARY QUICK UPDATER (Target: {limit} articles) ===")
    
    with get_connection() as conn:
        with conn.cursor() as cur:
            # Fetch recent articles to upgrade
            cur.execute("""
                SELECT id, title, summary, sources
                FROM new_articles
                ORDER BY published_at DESC, id DESC
                LIMIT %s;
            """, (limit,))
            rows = cur.fetchall()
            
            print(f"Fetched {len(rows)} recent articles from database for natural AI summarization.\n")
            
            updated_count = 0
            for idx, (art_id, title, raw_summary, sources) in enumerate(rows, start=1):
                raw_text = raw_summary or title or ""
                
                # Generate natural summary based on news depth
                new_summary = generate_natural_summary(title, raw_text, sources)
                
                if new_summary and new_summary != raw_summary:
                    cur.execute("""
                        UPDATE new_articles
                        SET summary = %s
                        WHERE id = %s;
                    """, (new_summary, art_id))
                    updated_count += 1
                
                # Print clean preview for first few articles
                if idx <= 5:
                    safe_title = title[:70].encode('ascii', 'replace').decode('ascii')
                    safe_summary = new_summary[:160].encode('ascii', 'replace').decode('ascii')
                    print(f"[{idx}] Article ID: {art_id}")
                    print(f"  Title: {safe_title}")
                    print(f"  Natural Summary: {safe_summary}...")
                    print(f"  Sources count: {len(sources) if sources else 1}\n")
                elif idx % 10 == 0:
                    print(f"  Processed {idx}/{len(rows)} articles...")


        conn.commit()
    
    print(f"[SUCCESS] Quick updater finished! Successfully updated {updated_count} articles with natural summaries.")
    print("These updated summaries are immediately visible in your UI dashboard and pgAdmin!")


if __name__ == "__main__":
    count_arg = 40
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        count_arg = int(sys.argv[1])
    run_quick_summary_updater(limit=count_arg)
