"""
Telugu wording review, for a Telugu speaker who does not need to touch any code.
  python scripts/telugu_review.py export [sheet.csv]    writes English next to Telugu for every screen text
  python scripts/telugu_review.py import <sheet.csv>    puts the corrections (column corrected_telugu) back into the app
After importing: cd frontend && npm run build, then restart the app.
Options: --src <folder>   the frontend/src folder (default: frontend/src)
"""
import csv
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
FILES = {"strings": "i18n/strings.js", "constants": "utils/constants.js"}


def _src():
    if "--src" in sys.argv:
        return pathlib.Path(sys.argv[sys.argv.index("--src") + 1])
    return ROOT / "frontend" / "src"


def _load(src: pathlib.Path) -> list[dict]:
    """Reads both dictionaries with Node (they are JavaScript files) and returns rows."""
    js = f"""
    const a = await import('file://{src}/i18n/strings.js');
    let b = null; try {{ b = await import('file://{src}/utils/constants.js'); }} catch (e) {{}}
    const rows = [];
    for (const k of Object.keys(a.STRINGS.en)) rows.push({{file: 'strings', key: k, english: a.STRINGS.en[k], telugu: (a.STRINGS.te||{{}})[k] || ''}});
    if (b && b.TRANSLATIONS) for (const k of Object.keys(b.TRANSLATIONS.en)) rows.push({{file: 'constants', key: k, english: String(b.TRANSLATIONS.en[k]), telugu: String((b.TRANSLATIONS.te||{{}})[k] || '')}});
    console.log(JSON.stringify(rows));
    """
    out = subprocess.run(["node", "--input-type=module", "-e", js], capture_output=True, text=True)
    if out.returncode:
        sys.exit("Could not read the dictionaries with Node: " + out.stderr[:300])
    return json.loads(out.stdout)


def export(path: pathlib.Path):
    rows = _load(_src())
    with path.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(["file", "key", "english", "telugu", "corrected_telugu", "note"])
        for r in rows:
            w.writerow([r["file"], r["key"], r["english"], r["telugu"], "", ""])
    print(f"Wrote {len(rows)} texts to {path}.")
    print("Reviewer: read 'english' and 'telugu'. Where the Telugu is wrong or unnatural, type the better wording in 'corrected_telugu'.")
    print("Keep any {words in curly brackets} exactly as they are: the app fills them in.")


def _js_quote(s: str) -> str:
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n") + "'"


def _te_block_bounds(text: str, which: str) -> tuple[int, int]:
    m = re.search(r"\bte\s*:\s*\{", text)
    if not m:
        raise ValueError("no te block")
    start = m.end()
    depth, i = 1, start
    while i < len(text) and depth:
        c = text[i]
        if c in "'\"`":                       # skip over string contents
            q = c; i += 1
            while i < len(text) and text[i] != q:
                i += 2 if text[i] == "\\" else 1
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        i += 1
    return start, i - 1


def import_(path: pathlib.Path):
    src = _src()
    texts = {n: (src / rel).read_text(encoding="utf-8") for n, rel in FILES.items() if (src / rel).exists()}
    applied, problems, placeholders_bad = 0, [], []
    for r in csv.DictReader(path.open(encoding="utf-8-sig")):
        new = (r.get("corrected_telugu") or "").strip()
        if not new or new == (r.get("telugu") or "").strip():
            continue
        f, key = r["file"], r["key"]
        if f not in texts:
            problems.append(f"{f}:{key} (unknown file)"); continue
        if set(re.findall(r"\{\w+\}", r["english"])) != set(re.findall(r"\{\w+\}", new)):
            placeholders_bad.append(f"{key}: the {{placeholders}} must match the English ({', '.join(re.findall(r'{\w+}', r['english'])) or 'none'})"); continue
        text = texts[f]
        s, e = _te_block_bounds(text, f)
        block = text[s:e]
        pat = re.compile(r"((?:['\"]" + re.escape(key) + r"['\"]|\b" + re.escape(key) + r")\s*:\s*)'((?:[^'\\]|\\.)*)'")
        if not pat.search(block):
            problems.append(f"{f}:{key} (could not find the Telugu text in the file)"); continue
        block = pat.sub(lambda m: m.group(1) + _js_quote(new), block, count=1)
        texts[f] = text[:s] + block + text[e:]
        applied += 1
    for n, t in texts.items():
        (src / FILES[n]).write_text(t, encoding="utf-8")
    print(f"Applied {applied} corrections.")
    for p in placeholders_bad + problems:
        print("  skipped:", p)
    if applied:
        print("Now: cd frontend && npm run build   then restart the app (./local.sh stop && ./local.sh start).")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--") and not (sys.argv[sys.argv.index(a) - 1] == "--src")]
    if not args or args[0] not in ("export", "import"):
        sys.exit(__doc__)
    if args[0] == "export":
        export(pathlib.Path(args[1] if len(args) > 1 else pathlib.Path.home() / "ai-smart-office-telugu-review.csv"))
    else:
        if len(args) < 2:
            sys.exit("Usage: telugu_review.py import <sheet.csv>")
        import_(pathlib.Path(args[1]))


if __name__ == "__main__":
    main()
