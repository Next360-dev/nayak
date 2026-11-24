# MASTER PLAN: Nayak from today to pilot. Execute top to bottom. Written 2026-11-24.

This file replaces the need to plan again. It binds together: `PRODUCT_PILLARS.md` (what), `UX_ARCHITECTURE.md` (how it looks), `BACKEND_ARCHITECTURE.md` (how it runs), `AI_BUDGET_PLAN.md` (AI last), `MODULE_SPECS.md` (every module's exact spec). Where they differ, THIS file wins.

## 0. Non-negotiables
1. Plain Python first; every feature works with AI off (CLAUDE.md AI-last rule). 2. Web and phone ship together for every module. 3. Server enforces roles and office scope; the UI only mirrors. 4. Tests and checks before "done"; report real output. 5. Humans approve anything sent, published or AI-made. 6. Unknown stays unknown: no invented data. 7. No force-push, deploy, paid service or outbound call without the owner's yes.

## 1. Decisions, with defaults (execution never waits: if the owner is silent, the default applies)
| # | Question | Default we proceed with |
|---|---|---|
| D1 | Navigation names | Today / Intelligence / Constituency / Office / Me + floating Assistant. Leaders see "Decisions" where staff see "Office" |
| D2 | Web navigation | Left sidebar + top bar (search, + New, bell, language, account) |
| D3 | Build order after foundations | Office (daily operations) first, then Constituency, then Legislative (after its spike) |
| D4 | Legislative | Data-source spike first; no screens before it |
| D5 | Metrics layer | Built in foundations |
| D6 | AI / telephony budget | None until the owner sets one: build only plain Python and the AI gateway with fakes |
| D7 | Voice | Tier 1 only (typed + device speech); keypad IVR later; open-speech IVR never without budget + legal review |
| D8 | Hosting | Owner's PC + tunnel for demos until a VPS is approved |
| D9 | Photos | Office staff add leader photos in Portfolio; Aadi's seeded |
| D10 | Pushing code | Claude pushes both repos at each phase gate only after the owner says "push" once for that phase |

## 2. Who does what
- **Claude (CTO):** foundations, security-critical code (scope, delegation, approvals), shared engines, specs, reviews, gate checks.
- **OpenCode:** bulk module work from `MODULE_SPECS.md` using the module template; never changes core/ or permission code without a Claude review.
- **Owner:** keys/accounts/budget, real data (contacts, photos), on-device checks at gates, pilot office, legal review, approvals.
Protocol for any builder: read the module spec -> write migration + tests first -> implement -> run checks -> tick the task -> stop at the gate.

## 3. The task board (IDs are referenced by every other doc)
Size: S small, M medium, L large. "dep" = must be done first.
### Phase 0: Foundations (two tracks run in parallel)
**Backend track B**
- B0.1 (S) Migration runner + `schema_migrations`; tests build a fresh DB from zero. 
- B0.2 (S) `core`: clock, errors (NotFound/Forbidden/Conflict/Invalid -> HTTP), logging with request id, settings.
- B0.3 (M) `core.http` client (timeout, retry+jitter, per-host limit, circuit breaker, size cap) + provider interfaces with fakes (Email, Push, Publisher, Transcriber, Speaker, Translator, Ocr).
- B0.4 (M, dep B0.1-2) Job worker: `python -m app.jobs.worker`, `job_runs`, advisory locks, retries/backoff, timeouts, heartbeat; `GET /api/health/deep`; admin Jobs API.
- B0.5 (M, dep B0.2) `office_scope(user)` + generated cross-office isolation test across all endpoints.
- B0.6 (S, dep B0.5) Module registry + `GET /api/modules` (id, pillar, area, name key, icon, roles, flag, badge).
- B0.7 (S) `metrics` events table + `record_event()` helper.
- B0.8 (S) CI gates: ruff, mypy strict on core+modules, pytest, coverage>=85% new code, "no payload: dict / SQL outside repositories / bare except" checks.
- B0.9 (L, dep B0.2-5) Harden OpenCode's code: split `features.py` into module folders, typed models for every route, tests for the 8 services.
- B0.10 (M, dep B0.4,9) Move all schedulers (top alerts, watchlist, social crawl, news refresh, briefing email) into the worker; remove threads from the API process.
- B0.11 (M) Notification bus: one `notify(event)` for push + email, `notifications` table, acknowledge/snooze/escalate API (module 35 core).
- B0.12 (M) Search API: Postgres full text + trigram + unaccent across registered modules, permission-aware.
**UX track U**
- U0.1 (M) Design tokens + component kit shared by web and phone (row, badge, KPI strip, chips, form fields, sheet/pane, two-tap confirm, empty/error/loading).
- U0.2 (L, dep B0.6) Web shell: sidebar from registry, top bar, command palette (Ctrl+K), bell, "+ New", language, account, assistant panel.
- U0.3 (L, dep B0.6) Phone shell: 5 tabs, hubs from registry (search + tiles with live counts), quick-create sheet, bell, assistant button.
- U0.4 (M) Module page template components (list, detail with Overview/Activity/Files, form, states) on web and phone.
- U0.5 (L, dep U0.2-4) Move today's screens into slots with no new behaviour (see UX doc section 6).
- U0.6 (M, dep B0.11) Notification center UI. U0.7 (M, dep B0.12) Global search UI.
- U0.8 (M) Playwright smoke: every route x every role (admin, leader, staff), zero console errors, no blank page; runs in CI.
- U0.9 (S) Accessibility + Telugu pass (contrast 4.5:1, 44px targets, long names, Telugu line height).
**Tighten track T (see `TIGHTEN_UP.md`, audited from the code):** T1-T7 (data and security of the finished modules) are part of Phase 0; T8-T14 (layering, typed input, tests, pagination) are done before GATE 1; T15-T21 run alongside Phase 2.
**GATE 0:** all B0/U0 tasks and T1-T7 green, owner opens both apps on a real device, owner says "push".

### Phase 1: Shared Python engines (pillars 1 and 5 use them)
- E1 (M) Gazetteer: leaders, officials, constituencies, places with Telugu/English aliases; exact entity matching; fixes name-variant misses.
- E2 (L) Tone engine v2: lexicon, negation, target-is-the-leader check; labeled set from "Report story"; scikit-learn model; accuracy report in CI (no regressions).
- E3 (M) Priority score: transparent (topic, urgency words, source trust, recency, outlet count) with "why" text; tuned from feedback.
- E4 (M) Dedupe: simhash + TF-IDF + fuzzy matching.
- E5 (S, dep B0.12) Search ranking and snippets. E6 (M) Extractive summary + briefing templates. E7 (M) Letter template engine (Jinja2, Telugu fonts, letterhead PDF). E8 (M, dep B0.4) OCR queue (Tesseract tel+eng).
**GATE 1:** T8-T14 done; accuracy numbers recorded; owner reviews 20 sample alerts for sense.

### Phase 2: Office Administration (pillar 4) in this order
O1 (M) generic record engine (letters become its first kind) -> O2 Visitors (7) -> O3 Appointments & tours (10) -> O4 Shift handover (29) -> O5 Delegation (30, Claude builds) -> O6 Unified approval inbox (28) -> O7 Activity reports (4) -> O8 Meeting brief (31) -> O9 Department tracker (9) -> O10 Meetings & minutes (15) -> O11 Events (16) -> O12 Records & files (20) -> O13 Real contacts (13) -> O14 Tasks v2 (34). Each = migration, typed API, tests, web + phone screens, audit events, metrics events.
**GATE 2:** run "A PA's day" script (section 5) end to end on a real device; owner signs off.

### Phase 3: Constituency Management (pillar 3)
C1 Grievances (5, with public form + SLA clock + escalation) -> C2 Project evidence (6) -> C3 Emergency alert (19) + emergency directory (32) -> C4 Funds (18) -> C5 Schemes (12) -> C6 Field app (11, offline) -> C7 Map & heatmap (14) -> C8 Survey analytics (17).
**GATE 3:** grievance lifecycle demo + metrics page shows real times.

### Phase 4: Intelligence content
P1 Watchlist polish + alert latency metrics (2) | P2 News/social hardening, per-source adapters + stale-source alerts (26, 27) | L0 Legislative data-source spike (report only) -> L1 parsers -> L2 verification queue + screens (3). **GATE 4:** spike report approved before L1 starts.

### Phase 5: Assistance, plain Python
A1 Assistant rules engine (21 tier 1: about 20 intents over office data, device speech) | A2 Briefing v2 (24) | A3 Drafting from templates (22) | A4 Extractive summarizer (23) | A5 Knowledge search UI (25) | A6 keypad IVR (optional, needs provider + legal). **GATE 5:** every assistance feature passes the "AI off" test.

### Phase 6: Pilot and release
R1 Pilot office onboarded (real data) | R2 Pilot metrics page (spec metrics) | R3 Security review + backup/restore drill | R4 VPS + hosting move (needs approval) | R5 Optional AI plug-ins behind the gateway (only if asked and funded). **FINAL GATE:** pilot report with real numbers.

## 4. Quality gates for every task
Migration idempotent | typed schemas | tests (service, repository, API role matrix + cross-office, job with fake clock) | audit + metrics events | web + phone screens | `tsc`, lint, build, pytest, Playwright smoke green | docs (`PRODUCT_MAP.md`, `MODULE_SPECS.md` status) | "AI off" check where AI could apply.

## 5. Day-in-the-life flows (these become the acceptance scripts)
**Leader, 3 minutes, phone:** open app -> Today shows briefing, top-5 alerts, "3 decisions waiting" -> Decisions: approve 2 letters, change 1 -> tap an overdue grievance -> call the officer from the card -> back to Today, counters at zero. Rule: no screen needs typing.
**PA/staff, a shift:** login -> Today queue (overdue first) -> register a visitor (name, purpose, who) -> log an incoming letter, assign owner + due date -> create appointment for the leader -> check alerts, acknowledge one -> end of shift: Handover (open items, risks, notes) -> next shift acknowledges.
**Admin, 1 minute:** Today = control room: jobs all green, last news/social update times, failed notifications = 0, disabled users; one red job opens its error log.
**Citizen:** opens the survey/grievance link on a phone, writes in Telugu, sends, gets a reference number, can check status.

## 6. Wireframes (low-fi; build to these)
```
PHONE (leader) Today                 PHONE hub (staff) Office               WEB (staff)
+------------------------------+   +--------------------------------+   +--------+---------------------------+
| (photo) Dr A  INC     [bell] |   | Office            [search]  [+]|   | LOGO   | search (Ctrl+K)  +New  bell|
| Vemulawada, MLA              |   |--------------------------------|   | Today  +---------------------------+
|------------------------------|   | Visitors 5   Appointments 3    |   | Intel. | Letters  [filters][+ New] |
| What needs you   3 decisions |   | Letters 8    Meetings 1        |   | Constit| list           | detail   |
| [Top alerts]  chips          |   | Handover     Tasks 4 (2 late)  |   | Office | row . row . row| Overview |
| Briefing (tap to read)       |   | Reports      Records           |   |  Visit.| row            | Activity |
|------------------------------|   | Delegations  Directory         |   |  Letters| row           | Files    |
| Today | Decis | Const | Intel| Me|   | Today | Office | Const | Intel | Me|   +--------+---------------------------+
+------------------------------+   +--------------------------------+   assistant panel opens from the top bar
```
Module page template (phone): header + count + [+ New] -> chips (Mine / All / Overdue) -> list rows (title, status badge, owner, due) -> detail full screen with tabs Overview / Activity / Files. Web: same, list left and detail right.

## 7. Risks and what we do (kept short; owner sees them at each gate)
Source changes/blocks (adapters, stale alerts, retries) | wrong tone/priority (accuracy report, human review, Report button) | citizen data (scope tests, retention, access log, legal review) | my testing is on mocked data (owner device check at every gate, Playwright in CI) | scope too big (gates; cut Phase 3 tail first, never Phase 0) | demo on a PC tunnel (VPS decision D8) | usage limits (specs make OpenCode self-sufficient).

## 8. Start here
Tasks B0.1 and U0.1 can start now, in parallel. Everything else follows the dependencies above.
