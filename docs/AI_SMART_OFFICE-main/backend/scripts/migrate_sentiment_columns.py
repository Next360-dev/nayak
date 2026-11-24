"""
scripts/migrate_sentiment_columns.py
Adds persistent sentiment and is_statewide columns and indexes to new_articles table,
and backfills sentiment and statewide flags for all existing articles.
"""

import sys
import os
import re

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_connection

def _fallback_sentiment(title: str, summary: str = "") -> str:
    text = f"{title} {summary}".lower()
    negative_indicators = [
        "death", "dead", "kill", "murder", "accident", "protest", "strike", "dharna",
        "crisis", "shortage", "flood", "fire", "scam", "corrupt", "arrest", "collapse",
        "suicide", "injury", "fail", "neglect", "delay", "crime", "theft", "bribe",
        "clash", "loss", "damage", "complaint", "hazard", "danger", "illegal", "fraud",
        "మృతి", "మరణం", "హత్య", "ప్రమాదం", "ధర్నా", "నిరసన", "సంక్షోభం", "కొరత",
        "వరద", "అగ్నిప్రమాదం", "స్కాం", "అవినీతి", "అరెస్ట్", "వైఫల్యం", "సమస్య",
        "ఫిర్యాదు", "మోసం", "దాడి", "దోపిడీ", "లంచం"
    ]
    if any(k in text for k in negative_indicators):
        return "negative"
    return "positive"

def migrate():
    conn = get_connection()
    cur = conn.cursor()
    try:
        print("1. Adding columns to new_articles...")
        cur.execute("""
            ALTER TABLE new_articles ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20) DEFAULT 'positive';
            ALTER TABLE new_articles ADD COLUMN IF NOT EXISTS is_statewide BOOLEAN DEFAULT FALSE;
            CREATE INDEX IF NOT EXISTS idx_new_articles_sentiment ON new_articles(sentiment);
            CREATE INDEX IF NOT EXISTS idx_new_articles_statewide ON new_articles(is_statewide);
            CREATE INDEX IF NOT EXISTS idx_new_articles_pub_at ON new_articles(published_at);
            CREATE INDEX IF NOT EXISTS idx_new_articles_constituency ON new_articles(constituency);
            CREATE INDEX IF NOT EXISTS idx_new_articles_district ON new_articles(district);
        """)
        conn.commit()
        print("Columns & indexes verified.")

        print("2. Backfilling statewide flag...")
        cur.execute("""
            UPDATE new_articles
            SET is_statewide = TRUE
            WHERE district = 'Statewide' OR constituency = 'Statewide';
        """)
        conn.commit()
        print(f"Updated {cur.rowcount} statewide rows.")

        print("3. Backfilling sentiment...")
        cur.execute("SELECT id, title, summary FROM new_articles WHERE sentiment IS NULL OR sentiment = 'positive';")
        rows = cur.fetchall()
        print(f"Checking {len(rows)} articles for negative classification...")
        
        neg_ids = []
        for r_id, title, summary in rows:
            s = _fallback_sentiment(title or "", summary or "")
            if s == "negative":
                neg_ids.append(r_id)

        if neg_ids:
            cur.execute("""
                UPDATE new_articles
                SET sentiment = 'negative'
                WHERE id = ANY(%s);
            """, (neg_ids,))
            conn.commit()
            print(f"Updated {len(neg_ids)} rows to negative sentiment.")
        else:
            print("No negative rows to update.")

        print("4. Migration complete! Sample distribution:")
        cur.execute("""
            SELECT sentiment, is_statewide, COUNT(*)
            FROM new_articles
            GROUP BY sentiment, is_statewide;
        """)
        for s, sw, cnt in cur.fetchall():
            print(f"Sentiment: {s} | Statewide: {sw} | Count: {cnt}")

    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    migrate()
