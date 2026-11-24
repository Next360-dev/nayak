# Backend architecture: how all 36 modules stay neat and do not fail. Written 2026-11-24, status: PROPOSED (owner to approve)

Companion to `docs/UX_ARCHITECTURE.md`. Stack stays: Python 3.14, FastAPI, PostgreSQL. The goal is not clever code; it is that every module is built the same way, is tested the same way, and fails loudly and safely.

## 1. What is wrong today (found in review, so we fix it once)
1. Scheduled jobs run as threads inside the web server: a restart stops them, two server workers run them twice, nothing records what ran.
2. `features.py` is one file for 8 modules and takes raw `payload: dict` (no validation, no limits). Some services contain SQL (`public_survey_service`).
3. No migration runner in the app (migrations are applied by hand). Rate limits live in memory and reset on restart.
4. Errors are sometimes swallowed (`except: pass` style) so failures look like "no data".
5. About 1,500 lines of new code have no tests; role/office isolation is checked module by module, not by one shared rule.

## 2. Code layout: one folder per module (vertical slices)
```
backend/app/
  core/        config, db (pool + transaction helper), clock, errors, logging, security, http client, scope
  modules/<module>/   router.py (thin) | schemas.py (Pydantic) | service.py (rules, no SQL) | repository.py (all SQL) | jobs.py | tests/
  modules/registry.py one list of modules: id, area, name key, roles, feature flag, badge query -> also served as GET /api/modules for the apps' navigation
  jobs/        worker.py (entrypoint), runner.py, schedule.py
migrations/    numbered SQL, applied by one runner that records them in schema_migrations
```
Old code moves into this layout when it is touched (no big-bang rewrite). New modules start there.

## 3. Rules every module follows (no exceptions)
- **Layers:** router calls service; service calls repository; only repositories contain SQL; routers never contain rules.
- **Input:** a Pydantic model for every request (types, max lengths, enums). `payload: dict` is banned (a test greps for it).
- **Scope:** one helper `office_scope(user)` returns the leader/office the user may touch; every repository query takes it. One parametrised test proves office A can never read or change office B, for every module's endpoints (generated from the registry).
- **Errors:** domain exceptions (`NotFound`, `Forbidden`, `Conflict`, `Invalid`) mapped to HTTP in one place. No bare `except`; every caught error is logged with context.
- **Writes are idempotent:** unique keys + `ON CONFLICT`; notifications use the send-once log; a retried request never creates a duplicate.
- **Lists are paginated** and indexed; no unbounded queries.
- **Audit:** every state change writes an audit event (who, what, when), visible in the record's Activity tab.
- **Time:** all code gets "now" from `core.clock` (so tests can fix it); store UTC.
- **Config:** settings from environment only; secrets never in the repo.

## 4. The job worker (step W0: build first)
A separate process: `python -m app.jobs.worker` (its own container/service next to the API). Jobs are plain functions with a decorator `@job("top_alerts", every="30m")`.
- **Table `job_runs`:** job, started, finished, status (ok / failed / skipped), rows touched, error text, next run. **Heartbeat** row for the worker.
- **Locking:** Postgres advisory lock per job, so a job never runs twice even with several workers or after a crash.
- **Retries:** failed run retries with backoff (1, 5, 15 min), then waits for the next slot; never a hot loop.
- **Timeouts:** every job has a maximum run time; a stuck job is killed and recorded.
- **Visibility:** admin "Jobs" screen (web + phone) and `GET /api/health/deep` (database, worker heartbeat, last success per job, stale job = red). The existing watchdog alerts on it.
Jobs (all current and planned): news_refresh, social_crawl, top_alerts, watchlist_check, briefing_email, scheduled_post_publish, alert_escalation (module 35), overdue_reminders, retention_cleanup, backup_check.

## 5. Calling the outside world safely (one HTTP client)
All external calls (news feeds, Google News RSS, social search, email, push, WhatsApp, AI, telephony) go through `core.http`: explicit timeout, retry with jitter on 429/5xx, per-host rate limit, a **circuit breaker** (after N failures stop calling for a while), response size cap, and typed errors. A provider outage degrades one feature with a clear message; it never takes the API down. Every provider sits behind a small interface (`EmailSender`, `PushSender`, `Publisher`, `AiClient`, `Telephony`) with a **fake** used in tests, so features are built and tested before keys exist.

## 6. Quality gates (CI blocks a merge unless all pass)
ruff (lint+format) | mypy strict on `modules/` and `core/` | pytest on a throwaway Postgres | coverage >= 85% on new modules | migration check (a fresh DB builds from zero, and every migration re-runs safely) | pip-audit | the "no `payload: dict`, no SQL outside repositories, no bare except" checks.
Test pyramid per module: service unit tests (pure, fake clock) -> repository tests (real Postgres) -> API tests including the role x endpoint matrix and cross-office isolation -> job tests with fake clock and fake providers -> one contract test per provider using recorded responses.

## 7. Per-module backend plan (tables, endpoints, jobs, outside dependency)
Status: D = done (needs hardening), P = partial, N = new. Wave numbers match the UX plan.
| # | Module | St | Tables / key endpoints | Jobs | Outside dependency / risk |
|---|---|---|---|---|---|
| 1 | Leader dashboard | P | `GET /api/today` (one call: brief, alerts, approvals, schedule) | none | needs 10, 24 |
| 2 | Competitor/watchlist alerts | P | watchlist, watch_hits | watchlist_check 30m | platform rules; not real-time |
| 3 | Legislative inbox | N | legislative_items (type, source_url, date) | legislative_fetch daily | source availability (PDF/web); human verify |
| 4 | Activity reports | N | activities (date, place, category, evidence), reports | none | evidence files (20) |
| 5 | Grievances | N | grievances, events; SLA clock | overdue_reminders, escalation | public form: rate limit + spam control |
| 6 | Projects | D | projects, milestones | none | harden: typed input, tests |
| 7 | Visitors | N | visitors, visits (queue, referral) | none | personal data: access log |
| 8 | Letters & petitions | D | work_items | overdue_reminders | add reference numbers, department |
| 9 | Department tracker | N | dept_requests, officers | overdue_reminders | uses contacts (13) |
| 10 | Appointments & tours | N | appointments, tours | reminder push | calendar rules, time zones |
| 11 | Field staff app | N | field_checkins, field_reports, geotag evidence | none | offline sync conflict rules |
| 12 | Schemes info | N | schemes (bilingual content) | none | content accuracy (owner) |
| 13 | Contact directory | P | contacts (jurisdiction) + CSV import | none | real data from owner |
| 14 | Map & heatmap | N | reads 5, 6 with geo columns | none | map data quality |
| 15 | Meetings & minutes | N | meetings, minutes, action_items -> tasks | none | none |
| 16 | Events | N | events, guests, checklists | none | none |
| 17 | Feedback & surveys | D | survey_responses (per leader) | none | spam: per-IP via trusted proxy header |
| 18 | Funds tracker | N | allocations, sanctions, releases, expenses (separate stages) | none | audit trail is mandatory |
| 19 | Emergency alert | N | incidents, assignments | push fan-out | push reliability |
| 20 | Records & files | N | files (versions, permissions, OCR text) | ocr_queue | storage choice, OCR (Tesseract) |
| 21 | Voice assistant | P | `/api/assistant/ask` (today: text from loaded data) | none | speech + telephony provider, budget |
| 22 | AI drafting | N | drafts (link to 8) | none | AI key; human review required |
| 23 | Document summarizer | N | summaries (link to file) | summarize_queue | AI key + OCR |
| 24 | Daily briefing | P | briefing_edits | briefing_email daily | AI optional later |
| 25 | Knowledge search | N | `GET /api/search` (shared with the UX shell) | index_refresh | permission-aware results |
| 26 | News intelligence | D | articles | news_refresh | source changes; quality labels |
| 27 | Social intelligence | D | social_posts | social_crawl | rate limits (done: backoff, cap) |
| 28 | Approval inbox | P | `GET /api/approvals` (letters, posts, suggestions, delegations) | none | one shape for all |
| 29 | Shift handover | N | handovers (+ acknowledge) | none | none |
| 30 | Delegation | N | delegations (scope, expiry, revoke) | expire_delegations | permission model change: careful |
| 31 | Meeting brief | N | composed from 8, 10, 15, 34 | none | needs those modules |
| 32 | Emergency directory | N | emergency_contacts, escalation paths | none | uses 13 |
| 33 | Role dashboards | D | registry-driven views | none | follows `/api/modules` |
| 34 | Tasks | D | team_tasks | overdue_reminders | add priority, dependencies, evidence |
| 35 | Notifications & escalation | P | notifications, acknowledgements | alert_escalation, retries | one event bus for push + email |
| 36 | Security & audit | D | audit_log, sessions | retention_cleanup | add retention rules |

## 8. Build order (aligned with UX plan)
- **W0 Foundations:** worker + `job_runs` + deep health; migration runner; `core.http` + provider fakes; error mapping; `office_scope`; module registry + `/api/modules`; CI gates. (Runs in parallel with UX step S0.)
- **W1 Harden what exists:** split `features.py` into module folders; typed models for every route; tests for all 8 OpenCode services; move jobs to the worker; fix remaining swallowed errors.
- **Waves 1-4:** the modules in the UX plan's order, each as a vertical slice with its tests and a fake provider before any real key.

## 9. Definition of done (per module)
Migration (idempotent) | typed schemas | service + repository layers | role and cross-office tests | job (if any) with fake-clock test | audit events | OpenAPI shown in the contract | docs/PRODUCT_MAP.md updated | web + phone screens done | CI gates green | demo script in the PR.

## 10. Honest limits
Python can make our code reliable; it cannot make outside sources reliable. We design for failure: timeouts, retries, breakers, clear status on screen, and alerts to the admin when a job is stale. Real voice/IVR and real posting to platforms still need provider accounts and budget (owner).

## 11. Update (see docs/PRODUCT_PILLARS.md)
Group `app/modules/` by pillar: `political/`, `legislative/`, `constituency/`, `office/`, `assistant/`, plus `platform/`. Add a `metrics` module (timestamps for alert notify/acknowledge, grievance assign/close, evidence) in W0. Pillar 5 is Python-first (templates, extractive summaries, Postgres search); an LLM is an optional per-office plug-in with human approval.
