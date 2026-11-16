"""
Is the local AI ready, and is it any good at news tone? Safe: it only READS (and asks the model 13 short questions).
  python scripts/ollama_check.py [model]        (or: ./local.sh ollama-check [model])
It never downloads a model. If one is missing it tells you the exact command, and you decide.
"""
import json
import os
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.config import settings
from app.services import sentiment_service as ss

# Clear-cut headlines with the label a person would give (used only as a quick sanity check, not a full accuracy test).
CASES = [
    ("Minister inaugurates new hospital wing in Karimnagar", "positive"),
    ("State government sanctions Rs 50 crore for road works", "positive"),
    ("Three killed as lorry hits auto near Warangal", "negative"),
    ("Farmers protest delay in paddy procurement", "negative"),
    ("District collector reviews monsoon preparedness meeting", "neutral"),
    ("Collectors conference to be held on Monday", "neutral"),
    ("జిల్లా కవికి కాళోజీ పురస్కారం", "positive"),
    ("రైతులకు కొత్త పథకం ప్రారంభం", "positive"),
    ("వైద్యుల నిర్లక్ష్యంతోనే వివాహిత మృతి", "negative"),
    ("పని స్థలంలో కూలీ మృతి", "negative"),
    ("కానిస్టేబుళ్ల కారు బీభత్సం", "negative"),
    ("తాగునీటి కోసం మహిళల ఆందోళన", "negative"),
    ("కలెక్టర్ అధ్యక్షతన సమీక్ష సమావేశం", "neutral"),
]
SUGGEST = [("gemma3:4b", "about 3.3 GB: best multilingual choice that may just fit a 3.6 GB graphics card"),
           ("gemma3:1b", "about 0.8 GB: fits easily, but Telugu will be weaker"),
           ("qwen2.5:3b", "about 1.9 GB: fast, Telugu is limited")]


def get(path):
    with urllib.request.urlopen(settings.OLLAMA_URL.rstrip("/") + path, timeout=5) as r:
        return json.loads(r.read().decode())


def main():
    print(f"Ollama address: {settings.OLLAMA_URL}")
    try:
        tags = get("/api/tags")
    except Exception as e:
        sys.exit(f"Ollama is NOT reachable ({e.__class__.__name__}). Start it in a terminal with:  ollama serve")
    models = [m["name"] for m in tags.get("models", [])]
    print("Ollama is running. Models installed:", ", ".join(models) or "none yet")
    model = (sys.argv[1] if len(sys.argv) > 1 else settings.OLLAMA_MODEL).strip()
    if not model:
        if models:
            print("Pick one and re-run:  ./local.sh ollama-check", models[0])
        else:
            print("\nNo model yet. You decide whether to download one (this is a multi-GB download). Suggestions:")
            for name, note in SUGGEST:
                print(f"   ollama pull {name}    ({note})")
            print("Then run:  ./local.sh ollama-check <name>")
        return
    if not any(m == model or m.split(":")[0] == model.split(":")[0] and ":" not in model for m in models):
        sys.exit(f"The model '{model}' is not installed. Download it yourself with:  ollama pull {model}")
    settings.OLLAMA_MODEL = model
    settings.OLLAMA_TIMEOUT_SECONDS = 60
    print(f"\nTesting '{model}' on {len(CASES)} obvious headlines (the first answer is slow while the model loads):\n")
    ai_ok = rule_ok = 0
    times = []
    for title, want in CASES:
        t = time.perf_counter()
        got = ss._ollama_label(title, "")
        times.append(time.perf_counter() - t)
        rule = ss._fallback_sentiment(title, neutral_fallback=True)
        ai_ok += got == want
        rule_ok += rule == want
        print(f"  {'ok ' if got == want else 'MISS'}  want {want:8} model {str(got):8} rules {rule:8} {title[:48]}")
    n = len(CASES)
    print(f"\nModel right on {ai_ok}/{n}; the keyword rules right on {rule_ok}/{n}. Average {sum(times) / n:.1f}s per headline "
          f"(so ~{sum(times) / n * 300 / 60:.0f} minutes for 300 new stories).")
    if ai_ok >= 11:
        print("Good. To use it: add  OLLAMA_MODEL=" + model + "  to the private settings file and restart.")
    elif ai_ok > rule_ok:
        print("Better than the rules but not great. Try a larger model, or keep the rules and rely on the Report button.")
    else:
        print("Not better than the keyword rules on these examples. Not recommended.")
    print("This is only a 13-headline sanity check. For a real number, use scripts/quality_sample.py and quality_score.py.")


if __name__ == "__main__":
    main()
