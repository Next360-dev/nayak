"""
Scores the app's labels against a person's answers (the CSV from quality_sample.py).
  python scripts/quality_score.py reviewed.csv
Reports, only over the rows that were filled in:
  urgent precision  = of the stories the app called urgent, how many truly were
  urgent recall     = of the truly urgent stories, how many the app caught
  tone accuracy     = how often positive/negative matched
"""
import csv
import sys


def main():
    rows = [r for r in csv.DictReader(open(sys.argv[1], encoding="utf-8")) if (r["your_priority"] or r["your_sentiment"]).strip()]
    if not rows:
        sys.exit("No rows have been filled in yet.")
    pr = [r for r in rows if r["your_priority"].strip()]
    sy = [r for r in rows if r["your_sentiment"].strip()]
    sys_urgent = [r for r in pr if r["system_priority"].strip() == "1"]
    true_urgent = [r for r in pr if r["your_priority"].strip() == "1"]
    tp = [r for r in sys_urgent if r["your_priority"].strip() == "1"]
    print(f"Reviewed: {len(rows)} stories ({len(pr)} priority answers, {len(sy)} tone answers)")
    print(f"Urgent precision: {len(tp)}/{len(sys_urgent)} = {100 * len(tp) / len(sys_urgent):.0f}%" if sys_urgent else "Urgent precision: the app called nothing urgent")
    print(f"Urgent recall:    {len(tp)}/{len(true_urgent)} = {100 * len(tp) / len(true_urgent):.0f}%" if true_urgent else "Urgent recall: you marked nothing urgent")
    ok = [r for r in sy if r["system_sentiment"].strip().lower() == r["your_sentiment"].strip().lower()]
    print(f"Tone accuracy:    {len(ok)}/{len(sy)} = {100 * len(ok) / len(sy):.0f}%" if sy else "Tone accuracy: no tone answers")
    wrong = [r for r in pr if r["system_priority"].strip() != r["your_priority"].strip()][:15]
    if wrong:
        print("\nExamples where priority differed (app -> you):")
        for r in wrong:
            print(f"  {r['system_priority']} -> {r['your_priority']}  {r['headline'][:90]}")


if __name__ == "__main__":
    main()
