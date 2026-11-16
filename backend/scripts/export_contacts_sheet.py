"""
Makes a ready-to-fill CSV of every MLA: constituency, name, party and district are already filled in from the app's own data;
phone and email are EMPTY for you to fill with real values. Then import it in the app: Users > Import contacts.
  python scripts/export_contacts_sheet.py [out.csv]
"""
import csv
import os
import pathlib
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.database import get_connection


def main():
    out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path.home() / "ai-smart-office-contacts.csv")
    conn = get_connection(); cur = conn.cursor()
    cur.execute("SELECT constituency_name, name, contact_phone, email, party, district_name FROM political_representatives "
                "WHERE COALESCE(role_type,'MLA') = 'MLA' ORDER BY district_name, constituency_name")
    rows = cur.fetchall(); cur.close(); conn.close()
    with out.open("w", newline="", encoding="utf-8-sig") as fh:   # utf-8-sig so Excel opens Telugu/English correctly
        w = csv.writer(fh)
        w.writerow(["constituency", "name", "phone", "email", "party", "role_type", "district"])
        for cons, name, phone, email, party, dist in rows:
            w.writerow([cons, name, phone or "", email or "", party or "", "", dist or ""])
    print(f"Wrote {len(rows)} MLAs to {out}. Fill the phone and email columns (leave unknown ones blank), then import it in the app.")
    print("To add the CM or a minister, add a row at the bottom: name, role_type (CM or Minister), and any phone / email / party / district.")


if __name__ == "__main__":
    main()
