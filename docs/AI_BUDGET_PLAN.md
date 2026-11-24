# AI budget plan: Python for everything, AI only where nothing else works. Written 2026-11-24, status: PROPOSED

Rule: every feature is built first as plain Python (rules, templates, statistics, Postgres). AI is added behind a gateway only where the plain version cannot do the job, switchable per office, metered, and always with a human approving the result.

## 1. What really needs AI (the honest list)
| Need | Why Python alone cannot do it | Cheapest safe route |
|---|---|---|
| **Speech to text** (voice assistant, field voice notes, IVR open speech, video transcripts) | turning sound into Telugu/English words is a trained-model job | in the apps use the phone's/browser's built-in recognizer (free to us); on the server a self-hosted open model (Whisper family, Indic-tuned models for Telugu) run in batch; cloud API only as fallback |
| **Text to speech** (read answers aloud, IVR prompts) | natural Telugu voice needs a model | device voice in the apps (free); for phone calls **pre-generate each fixed prompt once** and replay the audio file (no per-call cost) |
| **OCR of bad scans / handwriting** | printed Telugu is fine with Tesseract (Python, free); handwriting and poor scans are not | Tesseract first; cloud OCR only for pages it fails |
| **Telugu <-> English translation of free text** | grammar and meaning, not word swaps | self-hosted open translation model, cached; fixed UI text is already translated by us (strings file) |
Everything else on this list is optional (the plain version works; AI only polishes).

## 2. Feature by feature (36 modules)
- **Required AI component (3):** 21 Voice assistant (speech in/out), 23 Document summarizer (OCR for scans), 3 Legislative inbox (OCR for PDFs; transcripts only if videos are used).
- **Better with AI but plain Python ships first (7):** 22 Drafting (templates first), 24 Briefing (templates over real numbers first), 25 Search (Postgres full text first; small local embedding model only if needed), 27 and 2 tone nuance (rules + small trained model first), 5 Grievance triage (classical classifier first), 11 Field voice notes (store audio, transcribe in batch).
- **No AI needed (the other ~26):** letters, visitors, appointments, meetings, handover, delegation, tasks, projects, funds, emergency, directory, map, news, dashboards, notifications, security, and the rest.

## 3. The voice assistant, in three tiers (cost grows only when a client pays for it)
1. **In-app, typed + device speech (zero AI bill):** the assistant understands about 20 office questions by rules (counts, approvals, today's schedule, urgent stories) over the office's own data. Speaking uses the phone's own recognizer; reading aloud uses the phone's own voice.
2. **IVR with keypad menus (telephony bill only):** "press 1 for ..." plus pre-recorded prompts and templated answers. No AI per call. This is the cheap way to "talk to people by phone".
3. **IVR with open speech (AI bill, per minute):** STT + TTS per call. Offer as a paid add-on per office, with a monthly minute cap. Needs a telephony provider and a legal review (calls and political content are regulated).

## 4. The AI gateway (one Python module, `core/ai`) that keeps the bill under control
- **One interface per capability** (`Transcriber`, `Speaker`, `Translator`, `Ocr`, optional `TextModel`), each with a **fake** for tests and a **no-AI fallback** (so a feature degrades, never breaks).
- **Routing:** rules/templates first -> local open model -> paid cloud model last. Cloud is used only when the cheaper step is not confident.
- **Cache:** results keyed by a hash of the input; the same document, sentence or audio is never paid for twice.
- **Metering:** table `ai_usage` (office, feature, provider, units, estimated cost, time). Admin "AI usage" page with per-office totals and a monthly **budget cap**; at the cap the feature switches to its no-AI fallback and tells the user.
- **Per-office flags:** each AI feature is off until the office turns it on (and pays for it, if sold as an add-on).
- **Privacy:** personal data (phones, names of citizens) is masked before anything leaves the server; self-hosted models keep data on our machines; nothing is sent to a vendor without a recorded purpose.
- **Human in control:** AI output is a draft; a person approves before anything is sent, published or acted on (enforced in the service layer).
- **Batch and off-peak:** transcripts, translations and OCR run in the job worker queue, not live, unless the user is waiting.

## 5. How to keep the bill predictable
Quote clients per unit (minutes of voice, pages of OCR), not "unlimited". Measure real usage in the pilot before pricing. Start with self-hosted models on one modest server and move to cloud only for peaks. Review the AI usage page weekly.

## 6. Build order (AI last, never blocking)
1. Plain-Python versions of 22, 24, 25, 5, tone (templates, rules, Postgres, small model). 2. The gateway with fakes + metering + budget caps. 3. Tier 1 voice (typed + device speech). 4. OCR (Tesseract) for 20, 23, 3. 5. Tier 2 IVR (needs provider). 6. Optional AI plug-ins and Tier 3, only for offices that ask and pay.

## 7. What we need from the owner
Pilot budget per month for AI/telephony | which offices want voice by phone | a telephony provider choice | a legal review before any outbound or political calls | hardware for self-hosted models (or approval to use a cloud GPU).
