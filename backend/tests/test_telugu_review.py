"""The Telugu review sheet: export, import corrections safely (on temporary copies of the real files)."""
import csv
import pathlib
import shutil
import subprocess
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "telugu_review.py"
pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs Node")


def run(*args):
    return subprocess.run([sys.executable, str(SCRIPT), *args], capture_output=True, text=True)


@pytest.fixture()
def src(tmp_path):
    d = tmp_path / "src"
    (d / "i18n").mkdir(parents=True); (d / "utils").mkdir()
    shutil.copy(ROOT / "frontend/src/i18n/strings.js", d / "i18n/strings.js")
    shutil.copy(ROOT / "frontend/src/utils/constants.js", d / "utils/constants.js")
    return d


def load_te(src, file_rel, key):
    js = f"const m = await import('file://{src}/{file_rel}'); const d = m.STRINGS ? m.STRINGS.te : m.TRANSLATIONS.te; console.log(JSON.stringify(d['{key}']));"
    import json
    return json.loads(subprocess.run(["node", "--input-type=module", "-e", js], capture_output=True, text=True).stdout)


def test_export_lists_every_text_with_english_beside_telugu(src, tmp_path):
    out = tmp_path / "sheet.csv"
    r = run("export", str(out), "--src", str(src))
    assert r.returncode == 0, r.stderr
    rows = list(csv.DictReader(out.open(encoding="utf-8-sig")))
    assert len(rows) > 300 and {"file", "key", "english", "telugu", "corrected_telugu"} <= set(rows[0])
    nav = next(r for r in rows if r["key"] == "nav.home")
    assert nav["english"] == "Home" and nav["telugu"]


def test_corrections_are_applied_and_the_files_still_load(src, tmp_path):
    out = tmp_path / "sheet.csv"
    run("export", str(out), "--src", str(src))
    rows = list(csv.DictReader(out.open(encoding="utf-8-sig")))
    for r in rows:
        if r["key"] == "nav.home":
            r["corrected_telugu"] = "ముఖ్య పేజీ"
        if r["key"] == "acct.title":
            r["corrected_telugu"] = "నా 'ఖాతా' వివరాలు"                     # a quote inside the text
        if r["key"] == "team.added":
            r["corrected_telugu"] = "{u} ను చేర్చాం."                       # keeps the {u} placeholder: allowed
        if r["key"] == "admin.kpi.resolved":
            r["corrected_telugu"] = "పూర్తి శాతం"                           # DROPS the {pct} and {n} placeholders: must be refused
        if r["file"] == "constants" and r["key"] == "portalSubtitle":
            r["corrected_telugu"] = "తెలంగాణ ప్రభుత్వ పోర్టల్"
    with out.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)

    r = run("import", str(out), "--src", str(src))
    assert r.returncode == 0, r.stderr
    assert "Applied 4 corrections" in r.stdout and "admin.kpi.resolved" in r.stdout and "placeholders" in r.stdout
    assert load_te(src, "i18n/strings.js", "nav.home") == "ముఖ్య పేజీ"
    assert load_te(src, "i18n/strings.js", "acct.title") == "నా 'ఖాతా' వివరాలు"
    assert "{u}" in load_te(src, "i18n/strings.js", "team.added")
    assert "{pct}" in load_te(src, "i18n/strings.js", "admin.kpi.resolved")       # the bad correction was not applied
    assert load_te(src, "utils/constants.js", "portalSubtitle") == "తెలంగాణ ప్రభుత్వ పోర్టల్"
    # the English side and every other string are untouched
    again = run("export", str(tmp_path / "again.csv"), "--src", str(src))
    new_rows = list(csv.DictReader((tmp_path / "again.csv").open(encoding="utf-8-sig")))
    assert len(new_rows) == len(rows)


def test_a_sheet_with_no_corrections_changes_nothing(src, tmp_path):
    before = (src / "i18n/strings.js").read_text(encoding="utf-8")
    out = tmp_path / "sheet.csv"
    run("export", str(out), "--src", str(src))
    r = run("import", str(out), "--src", str(src))
    assert "Applied 0 corrections" in r.stdout
    assert (src / "i18n/strings.js").read_text(encoding="utf-8") == before
