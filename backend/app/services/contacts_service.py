"""
services/contacts_service.py - import real contact details (and extra people such as the CM / ministers) from a CSV.

Columns (header row required, any order, extra columns ignored):
  constituency, name, phone, email, party, role_type, district
Rules:
  - No role_type (or MLA): the row UPDATES the MLA of that constituency (phone / email only fill what is provided).
  - role_type is something else (CM, Minister, ...): the person is ADDED (or updated if the same name + role exists).
  - Every row is validated; bad rows are reported and skipped. Nothing is invented: blanks stay blank.
"""
import csv
import io
import re

from app.core.database import get_connection

MAX_ROWS = 1000
MAX_BYTES = 500_000
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^\+?[0-9][0-9 \-]{6,17}[0-9]$")


class ImportError_(Exception):
    pass


def _norm(s: str | None) -> str:
    return re.sub(r"\s*\((sc|st)\)\s*", "", (s or ""), flags=re.I).strip().lower()


def plan(csv_text: str) -> dict:
    """Reads the CSV and works out what WOULD change. Touches nothing."""
    if len(csv_text.encode("utf-8")) > MAX_BYTES:
        raise ImportError_("That file is too large (max 500 KB).")
    reader = csv.DictReader(io.StringIO(csv_text.lstrip("﻿")))
    if not reader.fieldnames:
        raise ImportError_("The file is empty.")
    reader.fieldnames = [(f or "").strip().lower() for f in reader.fieldnames]
    if not ({"constituency", "name"} & set(reader.fieldnames)):
        raise ImportError_("The first row must be a header with at least a 'constituency' or 'name' column.")
    rows = list(reader)
    if len(rows) > MAX_ROWS:
        raise ImportError_(f"Too many rows (max {MAX_ROWS}).")

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, name, role_type, constituency_name, contact_phone, email FROM political_representatives")
        people = cur.fetchall()
        cur.close()
    finally:
        conn.close()
    by_const = {}
    for pid, name, rt, cons, ph, em in people:
        if (rt or "MLA").upper() == "MLA":
            by_const.setdefault(_norm(cons), []).append((pid, name, ph, em))
    by_name_role = {((n or "").lower(), (rt or "").lower()): pid for pid, n, rt, _, _, _ in people}

    updates, adds, errors, warnings, blank = [], [], [], [], 0
    for i, r in enumerate(rows, start=2):
        g = lambda k: (r.get(k) or "").strip()
        cons, name, phone, email, party, rt, dist = g("constituency"), g("name"), g("phone"), g("email"), g("party"), g("role_type"), g("district")
        if not any((cons, name, phone, email)):
            continue  # blank line
        if phone and not PHONE_RE.match(phone):
            errors.append({"row": i, "error": f"Phone '{phone}' does not look right."}); continue
        if email and not EMAIL_RE.match(email):
            errors.append({"row": i, "error": f"Email '{email}' does not look right."}); continue
        if not rt or rt.upper() == "MLA":
            if not cons:
                errors.append({"row": i, "error": "An MLA row needs a constituency."}); continue
            if not (phone or email):
                blank += 1; continue   # an unfilled row of a pre-made sheet: not an error
            match = by_const.get(_norm(cons))
            if not match:
                errors.append({"row": i, "error": f"No MLA found for constituency '{cons}'."}); continue
            pid, existing_name, _, _ = match[0]
            if name and name.lower() != (existing_name or "").lower():
                warnings.append({"row": i, "warning": f"Name '{name}' differs from '{existing_name}'; kept '{existing_name}'."})
            updates.append({"row": i, "id": pid, "who": existing_name, "constituency": cons, "phone": phone or None, "email": email or None})
        else:
            if not name:
                errors.append({"row": i, "error": "A new person needs a name."}); continue
            existing = by_name_role.get((name.lower(), rt.lower()))
            op = {"row": i, "name": name, "role_type": rt, "party": party or None, "district": dist or None,
                  "constituency": cons or None, "phone": phone or None, "email": email or None}
            (updates if existing else adds).append({**op, "id": existing} if existing else op)
    return {"updates": updates, "adds": adds, "errors": errors, "warnings": warnings, "skipped_blank": blank}


def apply(p: dict) -> dict:
    """Writes a plan() result in one transaction."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        for u in p["updates"]:
            cur.execute("UPDATE political_representatives SET contact_phone = COALESCE(%s, contact_phone), email = COALESCE(%s, email), "
                        "party = COALESCE(%s, party), district_name = COALESCE(%s, district_name) WHERE id = %s",
                        (u.get("phone"), u.get("email"), u.get("party"), u.get("district"), u["id"]))
        for a in p["adds"]:
            cur.execute("INSERT INTO political_representatives (name, role_type, party, district_name, constituency_name, contact_phone, email) "
                        "VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (name, constituency_name) DO NOTHING",
                        (a["name"], a["role_type"], a["party"], a["district"], a["constituency"], a["phone"], a["email"]))
        conn.commit()
        cur.close()
    finally:
        conn.close()
    return {"updated": len(p["updates"]), "added": len(p["adds"])}
