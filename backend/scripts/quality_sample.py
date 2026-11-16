"""
Draws a random sample of today's stories so a PERSON can check how accurate the app's "urgent" and "negative" labels are.
Writes a CSV with the app's labels filled in and two empty columns for the human answer.
  python scripts/quality_sample.py [N=100] [out.csv]
Then fill `your_priority` (1 urgent / 2 civic / 3 standard) and `your_sentiment` (positive / negative), and run
  python scripts/quality_score.py out.csv
"""
import csv
import os
import pathlib
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services import news_service


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else pathlib.Path.home() / "ai-smart-office-review.csv")
    res = news_service.get_news_feed(period="today", news_scope="all", page=1, limit=200, user_role="admin")
    arts = res.get("articles") or []
    random.seed(7)
    pick = random.sample(arts, min(n, len(arts)))
    with out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["id", "headline", "district", "constituency", "system_priority", "system_sentiment", "your_priority", "your_sentiment", "note"])
        for a in pick:
            w.writerow([a["id"], a["headline"], a.get("district_name"), a.get("constituency_name"), a.get("priority_score"), a.get("sentiment"), "", "", ""])
    print(f"Wrote {len(pick)} stories to {out}")


if __name__ == "__main__":
    main()
