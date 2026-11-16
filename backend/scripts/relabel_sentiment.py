"""
Re-labels the tone of EXISTING stories with the current rules, with the neutral option applied.
  python scripts/relabel_sentiment.py            DRY RUN: only reports what would change (changes nothing)
  python scripts/relabel_sentiment.py --apply    really updates the database (take a backup first: ./local.sh backup)
Only for databases whose tone came from the keyword rules (no Gemini key). If GEMINI_API_KEY is set the script refuses unless
you add --force, because AI-labelled stories would be overwritten.
"""
import collections
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.database import get_connection
from app.repositories import audit_repository
from app.services.sentiment_service import _fallback_sentiment


def main():
    apply = "--apply" in sys.argv
    if os.getenv("GEMINI_API_KEY") and "--force" not in sys.argv:
        sys.exit("A Gemini key is set, so existing labels may come from the AI. Add --force if you still want to continue.")
    conn = get_connection(); cur = conn.cursor()
    cur.execute("SELECT id, title, summary, sentiment FROM new_articles")
    rows = cur.fetchall()
    moves, examples, updates = collections.Counter(), collections.defaultdict(list), []
    for id_, title, summary, cur_label in rows:
        new = _fallback_sentiment(title or "", summary or "", neutral_fallback=True)
        old = cur_label or "positive"
        if old == "negative":
            new = "negative"   # never downgrade: some negatives were set by an urgent priority this script cannot see
        moves[(old, new)] += 1
        if old != new:
            updates.append((new, id_))
            if len(examples[(old, new)]) < 5:
                examples[(old, new)].append((title or "")[:90])
    total = len(rows)
    print(f"{total} stories checked.")
    for (old, new), n in sorted(moves.items(), key=lambda kv: -kv[1]):
        tag = "same" if old == new else "CHANGE"
        print(f"  {old:9} -> {new:9} {n:5} ({100 * n / max(1, total):4.1f}%) {tag}")
    for (old, new), ex in examples.items():
        print(f"\nExamples {old} -> {new}:")
        for t in ex:
            print("   ", t)
    if not apply:
        print(f"\nDRY RUN: nothing was changed. {len(updates)} stories would change. Add --apply to update them.")
        return
    cur.executemany("UPDATE new_articles SET sentiment = %s WHERE id = %s", updates)
    conn.commit()
    audit_repository.log("sentiment_relabelled", actor="script", detail={"changed": len(updates), "checked": total})
    print(f"\nUpdated {len(updates)} stories.")


if __name__ == "__main__":
    main()
