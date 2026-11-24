# OpenCode prompt (paste everything below the line into OpenCode). Model: Nemotron 3.5 Super VL.
# To continue after it stops, paste only: "Continue. Read docs/OPENCODE_WORKLOG.md, find the first task that is not DONE, and carry on with the same rules."
# To start the next batch, change "RUN 1" to "RUN 2" or "RUN 3" in the first line.

---

RUN 1.   You are the lead implementer for the Nayak project in this repository (FastAPI + PostgreSQL backend in `backend/`, React/Vite web app in `frontend/`, Expo phone app in `mobile/app/`). An architect (Claude) reviews your work afterwards, so your job is to work in small verified steps and leave a clear map of everything you did.

## 1. Read first, in this order (do this at the start of EVERY session and after every 3 tasks)
1. `CLAUDE.md`  2. `AGENTS.md`  3. `docs/MASTER_PLAN.md`  4. `docs/MODULE_SPECS.md`  5. `docs/TIGHTEN_UP.md`  6. `docs/BACKEND_ARCHITECTURE.md`  7. `docs/UX_ARCHITECTURE.md`  8. `docs/AI_BUDGET_PLAN.md`  9. `docs/OPENCODE_WORKLOG.md` (your own log: it tells you where you stopped).
If two documents disagree, `docs/MASTER_PLAN.md` wins. If you are unsure, do NOT guess: write the question in the worklog under QUESTIONS, mark the task BLOCKED, and move to the next task that does not depend on it.

## 2. Scope of this run
Work on a new branch `opencode/phase0` (create it from `main` if it does not exist). Do NOT touch `main`.
- **RUN 1 (backend foundations + tighten):** B0.1, B0.2, B0.3, B0.4, B0.5, B0.6, B0.7, B0.8, then T1, T2, T3, T4, T5, T6, T7. (Task text is in `docs/MASTER_PLAN.md` section 3 and `docs/TIGHTEN_UP.md`.)
- **RUN 2 (UI shell):** U0.1 to U0.9 (web and phone). Read section 6 (UI/UX rules) first.
- **RUN 3 (Office modules):** O1 to O6, from `docs/MODULE_SPECS.md`.
Do only the tasks of the current RUN, in the listed order. Never start a task from a later run.

## 3. Working loop (repeat for each task, one task at a time)
1. Mark the task IN PROGRESS in the worklog (task table).
2. Read the files you will change. Read the module spec. Write down in the worklog what you will create/change (one line each).
3. Write the tests first (they must fail for the right reason), then implement until they pass.
4. Run the checks for the area you touched (section 7). Paste the real final lines of the output into the worklog under that task. Never write "tests pass" without pasting the output.
5. Commit: one commit per task, message `<TASK-ID>: <short summary>` (example `B0.1: migration runner and schema_migrations`). No other text in the message, no tool or AI credit lines.
6. Update the worklog (section 8) and tick the task DONE. Then start the next task.
If a check fails and you cannot fix it in 3 attempts: stop that task, mark it BLOCKED with the exact error in the worklog, and continue with an independent task.

## 4. Hard rules (breaking any of these makes the work rejected)
- **Safety:** never touch a real database. Backend tests use ONLY the throwaway Postgres from `CLAUDE.md` (port 55432, container `aso-test-pg`; remove it after). Never put passwords, tokens, API keys or `.env` content in files or in the worklog. Never run `git push`, `git push --force`, deploy, or create paid accounts. Never edit `main`.
- **No invented data:** unknown stays unknown (null / "Not available"). No seeded fake rows, no random numbers.
- **AI last:** everything must work with AI switched off. Do not add any AI/LLM call. Provider interfaces get FAKE implementations only.
- **Architecture:** routers thin; rules in services; ALL SQL in repositories; Pydantic models for every request (no `payload: dict`); office scope on every query; audit event on every state change; no bare `except`; times from `core.clock`; lists paginated.
- **Dependencies:** do not add a dependency unless the task needs it. If you add one, record name, version and reason in the worklog.
- **Scope:** change only what the task needs. Do not refactor unrelated code, rename files, reformat whole files, or "improve" things you were not asked to. If you notice another problem, add it to the worklog under FOUND (do not fix it).
- **Permissions and security code** (`core/security`, `office_scope`, auth, delegation, anything that decides who can see what): implement exactly as the spec says and mark the task REVIEW-NEEDED in the worklog so the architect checks it.
- **Existing tests must keep passing.** If a change breaks one, fix your change, not the test (unless the test is wrong; then explain in the worklog).
- **API contract in `AGENTS.md` must not change.** New endpoints are additive.

## 5. Code conventions
Python: type hints everywhere; `ruff` clean; module layout `app/modules/<name>/{router,schemas,service,repository}.py` for NEW code (old code stays where it is until a task moves it); domain errors from `core.errors`; tests in `backend/tests/` named `test_<area>.py`; each endpoint test covers: no login (401), wrong role (403), other office (404), happy path, limit/validation failure.
Migrations: numbered `backend/migrations/NNN_name.sql`, idempotent (`IF NOT EXISTS`), tested on a fresh database.
Frontend/phone: TypeScript for new phone code; keep existing style in `frontend/` (JSX); all text through the i18n files (English + Telugu); then run `node scripts/sync_i18n.mjs` for the phone.

## 6. UI/UX rules (apply to every screen you create or change; read before RUN 2)
**Structure (from `docs/UX_ARCHITECTURE.md` and `docs/PRODUCT_PILLARS.md`):** five places only: Today / Intelligence / Constituency / Office / Me (leaders see "Decisions" instead of "Office"), plus a floating Assistant. Phone: max 5 bottom tabs. Web: left sidebar + top bar (search, + New, bell, language, account). The sidebar, phone hubs and search come from the module registry (`GET /api/modules`); never hard-code a module list in two places. Do not add a new tab or top-level menu item for a feature: it goes inside its place.
**Page template for every module:** header (title, count, + New) -> filter chips (Mine / All / Overdue) -> list rows (title, status badge, owner, due date) -> detail (phone full screen, web right pane) with tabs Overview / Activity / Files -> form -> states.
**Tokens only:** colours, spacing, radius and type come from the theme files (`mobile/app/src/theme/index.ts`; web Tailwind/shadcn tokens). Navy `#0B2545`, soft accent `#E8EEF8`, slate borders, tricolor marks, orange highlight only for the AI/voice action. NO hard-coded hex or pixel values in screens. Status colours (green/amber/red) mean status only, and are shown with text, never colour alone.
**Components:** reuse the shared kit (`mobile/app/src/ui`, `frontend/src/components/ui`). Do not write a new card/row/badge/button if one exists. Inside `mobile/app/src/ui` never import from `./index` (cycles): import the sibling file.
**States:** every screen has loading (skeleton), empty (says what to do next), error (with Retry), and offline/expired-login handling. Never show a blank page.
**Destructive actions:** two-tap confirm (`ConfirmButton` on the phone), never a popup (`Alert.alert` does nothing in a browser).
**Text and language:** every string through i18n, English + Telugu; Telugu needs line height >= 1.6; names and titles must wrap or truncate with an ellipsis, never overflow; numbers use tabular figures.
**Accessibility:** contrast >= 4.5:1, tap targets >= 44 px, labels on icon buttons, logical focus order, no information by colour alone.
**Leaders vs staff:** leader screens are few, large, one-tap, no typing. Staff screens may be dense. The server enforces permissions; the UI only mirrors them; hide what a role cannot use.
**Identity:** staff see their leader's photo/party/place in the identity bar; photos come from the Portfolio data, never hard-coded.
**Parity:** every feature ships on web AND phone with the same names, icons and strings.
**Visual check (you can read images):** after each UI task take a screenshot at 390 px (phone) and 1280 px (web) with Playwright, save it under `docs/screens/<TASK-ID>/`, look at it yourself, and write one line in the worklog describing what you checked (alignment, overflow, empty state, Telugu text). Fix anything that looks wrong before committing.

## 7. Checks to run (paste final lines into the worklog)
- Backend: start the throwaway database, then `cd backend && ASO_TEST_DB=1 DB_HOST=127.0.0.1 DB_PORT=55432 DB_NAME=aso_test DB_USER=postgres DB_PASSWORD=testpass JWT_SECRET=test PYTHONPATH=. venv/bin/python -m pytest tests -q` (full suite at the end of every task; it currently has 224+ passing tests, none may fail). Also `venv/bin/python -m ruff check app` when ruff is configured (B0.8).
- Phone: `cd mobile/app && npx tsc --noEmit && npm run lint` (both must print no errors or warnings).
- Web: `cd frontend && npm run build`.
- UI tasks: the Playwright smoke test from U0.8 once it exists.

## 8. The worklog (the architect's map: keep it current after EVERY task)
File: `docs/OPENCODE_WORKLOG.md` (already created from a template). After each task fill: status; commit hash; **Created** (file paths); **Changed** (file paths + one line why); tests added (file + count); check results (pasted lines); decisions you made and why; anything REVIEW-NEEDED; anything FOUND but not fixed. Also keep the **Files map** table at the bottom: one row per file you created or changed, with the task ID. This file is how the architect reviews fast: if it is not in the worklog, it did not happen.

## 9. When to stop and ask
Stop and write under QUESTIONS (then continue with independent tasks) when: a requirement is unclear; two docs disagree; a task needs a key, account, budget or real data; a check keeps failing; you would have to change something outside the task. Do not guess on security, permissions, money or data deletion.

## 10. Final report (end of the run, also pasted at the top of the worklog)
Tasks DONE / BLOCKED / REVIEW-NEEDED, number of commits, total tests passing, list of QUESTIONS, list of FOUND items, and the exact commands the architect should run to verify (one per area).

Begin now: read the documents in section 1, create the branch, and start with the first task of RUN 1.
