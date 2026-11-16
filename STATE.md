# STATE: Nayak

Overall: web build 100%; mobile app code complete (M0-M6.4). One manual step left: M6.5 EAS preview build (needs user yes).
Working on: mobile app, release prep. Web build is 100% (final QA pass 2026-11-12: 375/768/1440 px checked for admin + mla, mobile header overflow fixed, login `class` bug fixed, focus ring + aria labels added, README port fixed). Launch-prep round (2026-11-13): admin password reset (UI + endpoint), /api/health, security headers, session-expired notice, load-error states with Retry; build + 35 tests pass. Not done: deactivate user (needs a DB column), CSP header.

## Done
- Notes items 1,3-7 (old platform), item 8 (login + sharing), all in NOTES.md
- Backend: JWT/argon2 auth, roles, 8 share endpoints, admin create-user, 6 passing tests
- Frontend: Bearer-token login, Share button + dialog, Shared drawer (inbox/sent/status/replies/unread badge), admin Users screen
- Bugs fixed on the way: missing shares.py (backend would not start), missing PyJWT/argon2 in requirements, hierarchy loaded before login (401), API base hard-coded to 3 ports
- Verified live in a real browser on a throwaway DB: admin shares -> MLA badge -> acting + reply -> admin sees both

## Your steps (cannot be done by me: your DB is not running here)
1. `pip install -r backend/requirements.txt`
2. Add `JWT_SECRET` (see .env.example) to `backend/.env`
3. `psql -d ai_smart_office -f backend/migrations/001_auth_and_shares.sql`
4. Check existing users have roles from: admin, mla, minister, staff. Old passwords must be argon2 hashes or users cannot log in (create/reset via Users screen)

5. Apply `backend/migrations/002_social_metrics_nullable.sql`
6. Clean fake social rows: `cd backend && python scripts/purge_fabricated_social_posts.py` (dry run), then add `--apply`

## Item 2 (social media): DONE, honest version
- Removed fake-post seeding + random engagement numbers; UI shows "Engagement not available"; 11 tests pass
- Not built: real engagement counts (needs paid API + your keys)

## Roles update (done)
- Minister can have a team (staff); minister + their staff see statewide news; minister can create tasks / run social scrape. 16 tests pass.

## Mobile app (Expo)
- Plan: `mobile/PLAN.md`. Full task list with checks: `mobile/TASKS.md`. Agent rules + API contract: `AGENTS.md`.
- Progress: M0-M6.4 complete (mobile code, typecheck + lint clean). M6.5 pending user approval.
- Open questions: hosting, Android/iOS, Expo + Firebase accounts, app name

## Scraper verification (2026-11-13, throwaway DB, real public feeds, no Gemini key)
- Full cycle: ~2,850 raw items -> ~1,975 stories in ~2 min; 34 districts, 8 publishers, no stale/future dates.
- Fixed: AP/other-state stories leaking through Telangana publishers (publisher domain counted as Telangana context).
- Fixed: same story stored twice under different districts (cross-district merge, keeps the correct constituency/district).
- Repeat cycle is idempotent (3rd run: 2 inserted, 13 updated, no duplicates).
- Known small gaps: a Hyderabad story whose summary mentions another state can be dropped; occasional non-governance sports item gets through. `python -m app.main` no longer auto-reloads (UVICORN_RELOAD=1 for dev). Run ONE backend process.
- 40 tests pass, build clean.

## Fresh-database setup (2026-11-13)
- Found: no database existed, and migrations assumed a base schema. Added `000_base_schema.sql`, `apply_migrations.py` (no psql needed), `seed_representatives.py` (119 MLAs from constituency_mappings.py), `create_admin.py` (hidden prompt), `docker-compose.yml` (local PostgreSQL).
- Tested from an EMPTY database via compose + setup_release.sh: tables OK, 33 districts / 119 constituencies, first automatic scrape inserted 1,965 stories in 126 s, admin + MLA UI load clean. 40 tests pass.
- Fixed: representatives panel read wrong field names (party/phone/email always blank) and the API invented a phone, email and "Independent". Unknown now shows "Not available".
- Not in repo data: phone/email/office for MLAs, ministers/CM (only the 119 MLAs exist in the repo). Add via DB when you have real values.

## Running locally on this machine (2026-11-13)
- `./local.sh setup | admin | start | stop | status | logs`. Config + secrets: `~/.config/ai-smart-office/local.env` (outside the repo, mode 600).
- Own PostgreSQL container `ai-smart-office-db-1` on 127.0.0.1:5440 (does not touch the other Postgres containers on 5432). Data volume survives restarts.
- Set up and started here: 119 MLAs loaded, web build done, backend on http://127.0.0.1:8000. Admin login is created by YOU: `./local.sh admin` (hidden prompt).

## Three levels: master admin / MLA / minister (2026-11-13)
- Master admin: new **Overview** screen (every MLA + minister: last login, shares new/seen/acting/done, oldest unseen share, team size). API `GET /api/admin/overview` (admin only).
- MLA and minister: new **My team** screen (add / reset password / disable / enable their OWN staff only; role is always staff). APIs under `/api/team/*`. Another leader's staff return 404.
- Header titles per level: "Master Control", "MLA Office - <constituency>", "Minister Office", "Team - <constituency>".
- Tests: 49 pass (9 new in test_team_overview.py). Verified live in a browser as admin, MLA, minister and staff; mobile 375 px has no overflow.
- Not built (after Saturday): different page layouts per level, per-leader tasks dashboard, activity history/audit log.

## Memory file
`docs/PRODUCT_MAP.md` = full feature/permission/API map + audit list (2026-11-13). Keep it updated.

## Sharing model changed (2026-11-14, user decision)
- Master admin shares NOTHING: control room only (system health, run scraper, all shares read-only, all users, reset/disable).
- Staff share up to their own MLA/minister; MLA/minister can also share down to their own staff. Everyone has their own inbox.
- Backend: 51 tests pass. Web verified in a browser for staff, MLA and admin. Fixed an old crash when switching Inbox -> Sent with items.
- MOBILE app still follows the old sharing rules: update before any build (see PRODUCT_MAP.md audit #11).

## Core-level enforcement (2026-11-14)
- Sharing rules moved into core service `app/services/share_service.py`; routes are thin. Dead old-model code removed.
- Database trigger (migration 004) enforces the sender/recipient pairing itself. 68 tests pass, the API tests run with the trigger on.
- Mobile app updated to the new rules (tsc + lint clean, not device-tested). `./local.sh start` now applies migrations on every start.

## Scope decision (2026-11-14, user)
- Mobile app is PAUSED (no device test, no EAS build, no further mobile work).
- Deploy is SKIPPED for now. Focus: the web app, running locally via ./local.sh.

## Demo logins (2026-11-14)
`./local.sh demo` created 7 `demo_*` accounts in the local DB (admin, MLA Kothagudem + 2 staff, minister + 2 staff). Passwords in ~/.config/ai-smart-office/demo-logins.txt. Remove with `./local.sh demo --remove` before any real use.

## Per-role home screens (2026-11-14)
- Every login now opens its own Home (Control Room / My Constituency / State Overview / Work Queue) with a Home | News feed tab bar. Built with shadcn/ui + Tailwind v4 (scoped). `GET /api/dashboard` + `services/dashboard_service.py`. Old Overview modal removed (its content is the admin Home).
- 74 backend tests pass; verified in a browser on the real local data with the demo logins (admin, MLA, minister, staff) + phone width.

## UI/UX pass complete (2026-11-14)
- Telugu/English switch (header button, remembered). All new screens translated; Telugu wording needs a native-speaker review.
- Share, inbox, team and users windows rebuilt with shadcn Dialog/Sheet; skeleton loading; clickable home lists. 74 backend tests pass; browser-checked in both languages and on a phone.

## Roadmap
`docs/ROADMAP.md` = the 3-phase plan for what is still missing (2026-11-14). Phase 1 (password change, audit log, backups, saved screen tests) is next; it needs nothing from the user.

## Roadmap complete as far as one person can (2026-11-14)
- Phases 1-3 worked through (see docs/ROADMAP.md status line). 108 backend tests, 44 saved browser checks in Chrome AND Firefox, 0 known dependency vulnerabilities, accessibility scan clean, CSP active, load test 50 users OK (59 req/s, 0 errors).
- Migrations 005 + 006 applied to the local database (backup taken first). Old Tasks API removed.
- STILL OPEN (needs other people/accounts): the real pilot week (docs/PILOT.md), a native Telugu speaker's review, an email account for alerts (SMTP), real MLA contact data + CM/ministers list, Safari/WebKit check. Deploy and mobile remain PAUSED.

## Phase 4 close-out done (2026-11-14, evening)
- Built so the human step is tiny: `./local.sh email-setup|email-test` (+ docs/EMAIL_SETUP.md), `contacts-sheet` (~/ai-smart-office-contacts.csv, 119 MLAs, phone/email blank), `telugu-review export|import` (~/ai-smart-office-telugu-review.csv, 374 texts), `watchdog` (+ cron line in docs/DEPLOY.md), WhatsApp button on Briefing, optional neutral tone (OFF) + `backend/scripts/relabel_sentiment.py` (dry run: 74% neutral / 9% positive / 14% negative on 2,595 real stories).
- Verified: 117 backend tests, 46 browser checks in Chrome AND Firefox, real-app restart + preview of the contact sheet (0 errors, 119 skipped blank), watchdog reports healthy.
- STILL NEEDS PEOPLE/ACCOUNTS: create an email account then `./local.sh email-setup`; fill phone/email in the contacts sheet and import it (+ CM/ministers rows); a Telugu speaker fills the review sheet; choose the tone option; the pilot week (docs/PILOT.md); Safari check (WebKit cannot run on this Linux machine); turn on the watchdog cron line. Deploy + mobile PAUSED.

## Local AI option + tidy-up (2026-11-14, night)
- Found and corrected: the live pipeline never used Gemini for tone (only the keyword rules). Built an opt-in local AI path (Ollama) in `classify_tone()` with strict safety limits and 11 tests (fake server). User's Ollama is running (127.0.0.1:11434) with NO models installed; nothing downloaded (the user decides: see docs/LOCAL_AI.md, `./local.sh ollama-check`).
- README rewritten to match reality, `.gitignore` added, docs index in README. Docs corrected (PRODUCT_MAP item 10, PILOT, ROADMAP).

## Sign-in screen redesigned (2026-11-14)
Split brand/form page, show-hide password, caps-lock hint, language switch, precise error messages (incl. 429 lockout). Old login CSS removed. 56 browser checks pass (Chrome + Firefox); a11y scan clean. Frontend rebuilt; the running app serves it (refresh the page).

## 2026-11-15: Team-first (Phase 5) DONE
Leader home is look-only; staff get a team task board, team notes and an editable morning briefing (migration 007, DB-guarded to one team). Single logo file `frontend/public/logo.svg`. Checks: 138 backend tests, 79/79 browser checks in Chrome and Firefox. Details: docs/PRODUCT_MAP.md "Team-first features".

2026-11-15 later: task-assignment email, accessibility scan on the team screens (clean), list-bullet fix, per-team sender recorded as ROADMAP Phase 6 (not built). 140 backend tests; 86/86 browser checks incl. 7 accessibility scans.

2026-11-15 deploy kit READY (not deployed; deploy still needs the user's yes, a server and a domain): Dockerfile, docker-compose.prod.yml, deploy/Caddyfile, .env.production.example, backend/scripts/predeploy_check.py (`./local.sh predeploy`), APP_ENV=production guard for JWT_SECRET, docs/DEPLOY.md rewritten. Proven on throwaway ports: empty DB -> 8 migrations -> HTTPS + HSTS + CSP, seed + team + logins, predeploy check (fails without admin, passes with), weak secret refused, restart keeps data, pg_dump backup restored into a new DB. Test stack removed.

2026-11-15 news timer fix: the engine counted 5-second sleeps, so a suspended laptop stalled the 3-hour timer (found: no cycle for 13 h; the machine was awake ~17 of 86 h). Now `automation_manager._wait_until_due` compares the real clock, so it catches up within seconds of waking (3 tests in tests/test_automation_wait.py). After the restart the cycle added 594 new stories. A real server never sleeps, so this mainly protects local use. For steady local news: disable sleep (`systemctl mask sleep.target suspend.target` is system-wide, so the user decides) or just keep the app running while awake.

## Redesign "Nayak" (started 2026-11-15)
- Name is now **Nayak** (title, header, login, Telugu నాయక్, emails, docs). Technical names (folder, `ai-smart-office-db-1`, `~/.config/ai-smart-office`) are unchanged on purpose.
- Style: calm light, one ink-blue hue (`--primary #0B2545`, `--brand #17408B`), amber `--attention` only for "needs attention", Public Sans + Noto Sans Telugu, flat cards (no shadows, gradients or glows). Tokens: `frontend/src/shadcn.css` and `:root` in `frontend/styles.css`. Logo: `frontend/public/logo.svg`.
- Phase 1 done: tokens, logo, header, login. Phase 2 done: admin/leader/staff homes (`home/shared.jsx` has `Stats` strip, `Section`, `Page`; `StoryRow` = headline, quiet meta line, actions). Tests: 86/86 browser checks incl. accessibility.
- Phase 3 TODO: team board, news feed/cards, sidebar filters, share inbox/modal, dialogs, social view. Known: header subtitle says "MLA Office" for an MP (needs an MP role/title); Vercel link not redeployed since phase 1.
- Phase 3a done (news feed): `NewsFeed.jsx` (title row, search + Filters, scope tabs, archive tools, one bordered list, pagination), `NewsCard.jsx` (headline first, quiet meta line, summary hidden when it only repeats the headline), `SidebarFilters.jsx` is now a right-side Sheet (opened by the Filters button), `UrgentAlertBanner.jsx` is a calm static strip (no ticker), `RepresentativesDirectory.jsx` restyled. Removed the hard-coded "recent dates" shortcuts (they were stale). 79/79 browser checks, axe clean on 4 news states.
- Phase 3b TODO: team board, share inbox/modal, team/users/account/audit/briefing dialogs, social media view, outlets modal; delete dead legacy CSS (`.app-container`, `.sidebar`, `.card`, ticker/aurora rules) once nothing uses it.

## Manual "Refresh news" + public demo (2026-11-16)
- Button `RefreshNews` (home screens + news page): `POST /api/news/refresh`, poll `GET /api/news/refresh/status`. A person with a constituency gets a QUICK refresh (their constituency + leader by name + district, about 2 s, `main_pipeline.run_quick_refresh`); minister/admin get the full run (~50 s). One refresh at a time; cooldown 45 s per team, 180 s for the full run (`app/services/refresh_service.py`). Audit action `news_refresh`. Tests: `backend/tests/test_refresh.py`, 3 browser checks. 150 backend / 89 browser checks pass.
- Demo setup: laptop backend runs with `DEMO_FREEZE=1` (no scheduled robot); a Cloudflare quick tunnel carries `/api` from Vercel to the laptop (address is in `frontend/vercel.json`; it changes if the tunnel restarts, then edit and redeploy). Public link: https://frontend-omega-bay-14.vercel.app
- Code is in the PRIVATE GitHub repo `shivaganesh9515/nayak` (branch `main`, without `mobile/app`, which is its own repo). Vercel project `frontend` is connected to it (root directory `frontend`), so a push to `main` deploys. Data (news, users) lives in the laptop database, never in git.

## Etala Rajender = MP of Malkajgiri Lok Sabha (2026-11-16)
- A leader's seat can now be an AREA of several constituencies (`AREAS` in `backend/constituency_mappings.py`; Malkajgiri Lok Sabha = Medchal, Malkajgiri, Quthbullapur, Kukatpally, Uppal, L.B. Nagar, Secunderabad Cantt. (SC)). News filters expand the area to its members (`news_repository._constituency_variants`); each story shows its OWN segment. Quick refresh searches every member + his name + their districts (~3 s).
- Users have `leader_title` (e.g. MP) and `leader_party` (migration 008); staff inherit both. `/api/me` returns them; screens say "MP Office", "Waiting on MP". Admin list shows MP.
- Set up with `backend/scripts/set_leader_area.py --leader etala_rajender --area "Malkajgiri Lok Sabha" --title MP --party BJP --name "Etala Rajender"` (also writes his profile card, no invented contact data, and tags stored stories that name him). Already run on the local database.
- Not done: his phone/email (import via Contacts CSV), "Today" is the IST calendar day (early morning it is empty by design; Archive starts at yesterday).
- Tests: 153 backend, 89 browser (axe clean).

## Rolling 24 h + 48 h window (2026-11-16)
- "Latest" (the old Today) = a rolling LAST 24 HOURS; Archive = everything older, so they never overlap (`news_repository._build_time_clauses`, social view the same). Archive presets: all older, 24-48 h, 3, 7, 14 days. Test: `backend/tests/test_time_window.py`.
- Collectors look back 48 h on EVERY run (`backend/news_window.py`, env `NEWS_WINDOW_HOURS`, default 48), so a gap (sleeping laptop, missed run) is filled next time. Stories are kept 60 days and never overwritten (repeats are merged), so every leader and staff member sees the same stored news for their scope.
- Backfilled now: Rajender 13 stories in 24 h + 15 in 24-48 h (staff identical).
