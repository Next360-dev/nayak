# Free, private AI for the news tone (Ollama): optional

**Why:** the app decides "positive / negative" with keyword rules. They are rough (about 74% of stories have no clear
word either way). A small AI model running on your own computer can read the whole headline, in Telugu or English, with no cost
and nothing sent to anyone. (A Gemini key does NOT do this: the live pipeline never uses it for tone.)

**Safe by design:** it is OFF until you set a model. If Ollama is off, slow or unsure, the app silently uses the keyword
rules, so it can never stop news from arriving. Urgent stories are never touched by it.

## 1. Check what you have (nothing is downloaded)
```
./local.sh ollama-check
```
It tells you whether `ollama serve` is running and which models are installed.

## 2. Download a model (YOUR decision: it is a few GB)
Your graphics card has about 3.6 GB of memory, so choose a small model:
| Model | Size | Telugu | Note |
|---|---|---|---|
| `gemma3:4b` | ~3.3 GB | best of these | may just fit; slower if it spills to the processor |
| `gemma3:1b` | ~0.8 GB | weak | fits easily, quick |
| `qwen2.5:3b` | ~1.9 GB | limited | fast |

```
ollama pull gemma3:4b
```

## 3. Test it on 13 obvious headlines
```
./local.sh ollama-check gemma3:4b
```
It prints the model's answer next to the keyword rules' answer for each headline, the time per headline, and a plain verdict.
This is only a sanity check. For a real number, take the accuracy sample (`docs/PILOT.md`, "Measure the news accuracy").

## 4. Turn it on (only if it looked good)
Add to `~/.config/ai-smart-office/local.env`:
```
OLLAMA_MODEL=gemma3:4b
```
then `./local.sh stop && ./local.sh start`. From the next news update, NEW stories are labelled by the model. Existing stories keep
their old label (`backend/scripts/relabel_sentiment.py` only knows the keyword rules).
Optional: `SENTIMENT_NEUTRAL_FALLBACK=true` lets the model's "neutral" answers show as neutral (no badge, All News only).

## What to expect
- Speed: about 1 to 3 seconds per new headline on a small graphics card. A normal update (a few hundred new stories) adds a few
  minutes in the background. The first update after switching on may take longer.
- Limits per update: at most 400 stories and 10 minutes; the rest use the rules.
- Turn it off any time: remove the `OLLAMA_MODEL` line and restart.
