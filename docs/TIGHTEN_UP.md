# Tighten-up list for everything already built. Audited 2026-11-24 from the code. Part of MASTER_PLAN Phase 0.

What the audit found (counts from the code, not opinions):
- 9 routes take a raw `payload: dict` (all of `features.py`, plus translation): no types, no limits.
- 11 services contain SQL (all 8 new ones, plus social, translation, contacts, refresh): layering broken.
- 29 broad `except Exception` handlers; most log, a few hide a failure as "no data".
- In-memory state that breaks with 2 workers or a restart: survey rate limit, social crawl timestamps, translation cache (5 places).
- 6 of the 8 new services have NO tests: composed posts, watchlist, WhatsApp intake, projects, top alerts, leader suggestions.
- Input limits missing: WhatsApp text (unbounded), projects (milestones/photos unbounded), some list queries without LIMIT; the posts list returns every image in full.

Order: P0 (data and security) before GATE 0. P1 (structure) before GATE 1. P2 (quality) alongside Phase 2. Each task: tests first, then fix; "Done when" is the acceptance.

## P0: data and security (do first)
| ID | Module | Fix | Done when |
|---|---|---|---|
| T1 | 17 Survey | DONE: per-leader link, bounded inputs, no IP shown. Remaining: trusted-proxy client IP (`TRUST_PROXY=1`, `X-Forwarded-For`), DB-backed rate limit, 12-month retention job | rate limit survives a restart and counts real visitors behind Vercel/tunnel |
| T2 | WhatsApp intake | Pydantic model; max 20,000 chars; rate limit per user; mask phone numbers in list views; 90-day retention job; isolation test | oversized/foreign-office requests refused; test proves office A cannot read office B |
| T3 | 6 Projects | Typed model: title <=180, <=40 milestones each <=200 chars, <=10 photo links (https only, no inline base64); isolation + role tests | limits enforced; only staff write, leader/admin read |
| T4 | Post studio | List returns a thumbnail flag, image fetched on the detail call; LIMIT + pagination; scheduled_at must be in the future; state machine draft -> approved/rejected (leader only) -> posted(stub); tests | list payload small; leader-only approval tested; staff cannot approve |
| T5 | 2 Watchlist | Typed names (<=80 chars, max 5 enforced server-side); `check-now` rate limited (it calls Google); last-crawl state moved from memory to the job table | check-now spam refused; restart does not re-crawl everything |
| T6 | Top alerts + suggestions | Tests for send-once and office scope; suggestions expire after 7 days; assigned_to validated against active staff (exists) | duplicates never sent; stale suggestions hidden |
| T7 | Public endpoints | One shared limiter (DB-backed), honeypot field, response size cap; same rules for survey, public portfolio, future grievance form | one test file proves all public endpoints are limited |

## P1: structure (before GATE 1)
| ID | Fix | Done when |
|---|---|---|
| T8 | Move SQL out of the 11 services into repositories (one module at a time, behaviour unchanged) | a check fails if SQL appears in `services/` |
| T9 | Replace all `payload: dict` with Pydantic models (types, lengths, enums) | a check fails if `payload: dict` appears |
| T10 | Replace the 29 broad excepts: catch the specific error, log with context, return a clear status; never turn a failure into empty data | each remaining broad except has a comment and a test |
| T11 | Move in-memory state (rate limits, crawl timestamps, translation cache) to Postgres tables or the worker | restarting the API changes nothing observable |
| T12 | Write the missing tests for the 6 untested services: role matrix, cross-office isolation, happy path, limits | coverage >= 85% on those services; isolation test generated from the registry |
| T13 | Pagination + LIMIT on every list endpoint; index review (EXPLAIN on the heavy ones) | no unbounded list; list calls stay under 200 ms on the sample DB |
| T14 | Split `features.py` into one folder per module (`router/schemas/service/repository`) | file removed; routes identical; all tests green |

## P2: quality (alongside Phase 2)
| ID | Fix | Done when |
|---|---|---|
| T15 | News/social: `source_health` table, stale-source alert to admin, per-source adapters | a dead source turns the Jobs page red |
| T16 | Web: split the 477 kB bundle with `React.lazy`; delete or move the three unwired drafts (`demo.tsx`, `creator-dashboard.tsx`, `ministerial-dashboard.tsx`) | build warning gone; no unused files |
| T17 | Phone: translate the remaining body text; replace every `Alert.alert` (no-op in a browser) with the two-tap confirm; real-device pass at 360 px, font 1.3, Telugu | owner signs off on a real device |
| T18 | Parity check script: compares the module registry with web routes and phone routes; fails when a module is missing on either | CI fails on drift |
| T19 | Docs: `PRODUCT_MAP.md` lists every endpoint in `features.py` and `portfolio.py`; `MODULE_SPECS.md` statuses updated | no endpoint missing from the map |
| T20 | Letters: reference numbers + department + web screens (phone already has them) | letters usable on both apps |
| T21 | Aadi portrait: host the file ourselves, remove the hard-coded web fallback | no third-party image link in the code |

## Where this sits in MASTER_PLAN
Track T runs next to B0/U0 in Phase 0. GATE 0 now also requires T1-T7. GATE 1 requires T8-T14. T15-T21 run alongside Phase 2, one per module touched.
