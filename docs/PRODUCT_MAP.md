# Nayak: Product Map (read this instead of re-reading the code)

Role and dashboard behavior reviewed: 2026-11-24 (Milestone 1 office role split). Mobile parity status last verified 2026-11-18 (M7-M13.2 done; M13.1 device test and M13.4 EAS build still pending). If you change a feature, update this file in the same change.

## 1. The idea in one paragraph
Governance news for Telangana, collected automatically and shown to leaders. News is scraped from public sources every
3 hours, de-duplicated, tagged to a district / constituency / MLA, and shown in a web dashboard.
- **Staff** (the background team) find stories and **share them up to their own MLA or minister**.
- **MLAs and ministers** receive them, mark seen / acting / done, reply, and can also **share down to their own staff**.
- **Master admin** shares NOTHING. It is the control room: checks system health, watches activity and all shares
  (read-only), and supports people (reset passwords, disable/enable logins, run the scraper).

## 2. The three levels (what "3 dashboards" means here)
There is ONE web app, but every login opens its OWN HOME screen (built with shadcn/ui). The header navigation now exposes **Home | Today’s Live News | Social Media | History | Official Portfolio**. Home data comes from `GET /api/dashboard` (role-aware, computed server-side in the login's own scope by `services/dashboard_service.py`).

| Level | Roles | Home focus | News they see | Main work |
|---|---|---|---|---|
| 1. Master admin | `admin` | System control room | whole state, all filters | Manage accounts and system health; inspect records and all shares |
| 2. Leader | `mla`, `minister` | Decisions and oversight | MLA's constituency or minister's statewide scope | Act on shares, approve posts, oversee team and projects |
| 3. Staff operations | `staff` | Daily office work | Their linked leader's scope | Review and route stories, manage intake/watchlist/projects, prepare posts and team work |

Staff = the office operations lead: they work the daily queue, monitor issues, take in WhatsApp and public feedback, maintain projects and watchlists, prepare posts, and route decisions to their leader. Staff have the leader's news scope and their own inbox; they do not administer accounts across offices. The separate master admin owns system-wide account and health controls.
The role-specific home screens and team task board are built. Public survey responses are readable by staff and leaders; system-wide control remains in the master admin view.

### Leader and staff presentation workspace (2026-11-24)
- Leader and staff homes expose a dedicated presentation workspace. Staff enter the operations walkthrough; leaders enter the oversight and approvals walkthrough.
- The walkthrough covers simulated IVR intake, public feedback, constituency projects, WhatsApp group message routing, and post composition/approval.
- Every record is illustrative and every interaction is held in page state only. The walkthrough does not call telephony/WhatsApp providers, invoke the real intake or post APIs, or write office records.
- Staff can preview intake classification, record a sample feedback follow-up, advance project progress, prepare an update, and route a draft to the local approval preview. The leader view can inspect outcomes and simulate approve/request-changes decisions.

### The four home screens (first thing after login)
- **Master admin = "Control Room"**: 4 KPI cards (leaders, staff accounts, shares + % resolved, news last 24 h); "Needs your attention" list (database down, news stale, leaders with shares unopened > 24 h, accounts that never logged in, disabled accounts) with action buttons; "System health" card (database, news, scraper, **Run news update now**); Leaders table (last login, shares New/Seen/Acting/Done, team size); Recent share activity (read-only).
- **MLA / Minister = decision and oversight home**: 3 big numbers (Waiting for me / Urgent today / Negative today), then the team inbox with one-tap status actions and "Needs attention today" stories; leaders can approve staff post drafts, review project progress, see suggestions/alerts, and oversee their team. Minister only: district table.
- **Minister = "State Overview"**: same KPIs plus a **Districts needing attention** table (urgent, negative, total per district) and statewide stories to act on.
- **Staff = "Staff operations"**: KPIs Stories today / Waiting on MLA|minister / Being acted on / Done; stories to review and route to the leader; sent and received shares; public feedback inbox; watchlist and WhatsApp intake tools; create/update actions for posts, projects, briefing, and the team board.
The news area remains one role-scoped feed with sidebar filters, urgent alerts, card results, and pagination. Its primary tabs jump directly to today, social, and history scopes. **Official Portfolio** is a dedicated office portfolio workspace: staff can publish verified profile, biography, ministry milestone, office contact, and constituency project updates; leaders get a read-only view; master admin retains the representative directory. The portfolio editor keeps publish and public preview actions visible in the header and reports outdated/missing backend routes with a retry instruction. Unknown contact details remain blank until supplied.

## 3. Features every logged-in user has (the News feed tab)
- **Urgent banner**: live ticker of high-priority (P1) alerts for the constituency (or statewide).
- **Sidebar filters**: search keyword, district, politician/MLA, constituency, priority (All / P1 high / P2 civic / P3 standard). Scoped users are pinned.
- **Today's Live / History Archive** toggle. History filters: All, Past 24h, 3 days, 7 days, 14 days, or one specific date. Auto-refresh every 30 s.
- **Scope tabs with counts**: All News, Positive, Negative (called "MLA Positive/Negative" for MLAs), Statewide, Constituency Civic, Social Media.
- **News card**: priority / civic / sentiment / district / constituency tags, posted time, source badge, "+N outlets" popup listing every outlet, constituency leader, **Share** button, **Translate** button (English/Telugu via the public MyMemory web service, cached in the DB; the article text is sent to that service). Pagination.
- **Representatives panel**: one card per MLA: name, party, role, constituency, district. Phone/email show "Not available" (no real data loaded; never invented).
- **Social Media tab**: public mentions of the MLA on Instagram, X/Twitter, YouTube, Facebook (found via Google News restricted to each site), with platform / sentiment / search filters and a scrape button. Engagement counts (likes, views) are NOT available, so shown as "Engagement not available".
- **Shared inbox (drawer)** (admin: "All shares", read-only): Inbox and Sent tabs, unread badge (checked every 60 s), status buttons (seen / acting / done), private reply thread per recipient, urgent flag. Everyone's inbox is their own.
- **Safety nets**: "Retry" bars when lists fail to load, "session expired, log in again" notice, wipe of all on-screen data on logout.

## 4. Level-specific features
**Master admin (control room, never shares)**
- **Overview ("Control room")**: system panel (database working/down; news = stories in 24 h + newest age, red warning if nothing new for 6 h; scraper last run / status / next run; **Run news update now** button) + every MLA and minister: last login (or "Never logged in"), shares they received New / Seen / Acting / Done, oldest unseen share (flagged after 24 h), team size. Totals row. Refresh.
- **Users**: tab "All users" (search; role, who staff work for, last login, disabled flag; **Reset password**, **Disable/Enable** for any non-admin) and tab "Create user" (any role).
- **All shares (read-only)**: every share in the system as `sender -> recipients`, status per recipient, notes and full reply threads. Cannot send, reply or change status.
- API-only: `GET /api/automation/status`.

**MLA and minister ("My team")**
- Add staff (role is forced to `staff`, linked to themselves), reset a staff member's password, disable / enable staff (a disabled person is logged out at once, username stays taken).
- Can only touch their own staff; another leader's staff answers 404.
- Leader: receives staff shares in their inbox and can **share down to their own active staff** ("Send to my team"). Staff: can **share up to their own MLA/minister only** ("Send to my MLA / minister", leader preselected) and read what the leader sends them.

## 5. Who can do what (server rules; the UI only mirrors them)
| Action | admin | mla | minister | staff |
|---|---|---|---|---|
| See news | whole state | own constituency | whole state | like their leader |
| Create a share | NO | to own active staff | to own active staff | to own leader only |
| Broadcast (all MLAs / district) | removed for everyone | no | no | no |
| Read inbox | none (own is empty) | own | own | own (NOT the leader's) |
| See all shares + threads | YES, read-only | only own | only own | only own |
| Reply / set status | NO | yes (own) | yes (own) | yes (own) |
| Create users | any role | own staff | own staff | no |
| Reset password / disable | any non-admin (admin accounts cannot be disabled) | own staff | own staff | no |
| Overview / system health / run scraper | yes | no | no | no |
| Social scrape | yes | own constituency | yes | like leader |
**Where the sharing rules live (3 layers, all tested):** (1) core service `backend/app/services/share_service.py` (used by the routes in `routes/shares.py`); (2) the DATABASE, trigger `enforce_share_pair` from `migrations/004_share_pair_guard.sql` rejects any forbidden sender/recipient pair even from direct SQL; (3) the web and mobile screens only mirror it.
Auth = signed Bearer token only (header `X-User-*` is ignored). Role is re-read from the DB on every request. 5 wrong passwords = 15-minute lock (in memory, per process). Web token lasts 8 h (`JWT_EXPIRE_MINUTES`).

## 6. API list (all need `Authorization: Bearer <token>` unless noted)
- Auth: `POST /api/login` (no token), `GET /api/me`, `POST /api/token/refresh`, `POST /api/logout`
- Users (admin): `GET /api/users`, `POST /api/users/create`, `POST /api/users/reset-password`, `POST /api/users/set-active`
- Admin: `GET /api/admin/overview` (leaders' activity + `system` health block)
- Team: `GET /api/team`, `POST /api/team/create`, `POST /api/team/reset-password`, `POST /api/team/set-active` (mla/minister)
- News: `GET /api/news`, `POST /api/translate`
- People: `GET /api/hierarchy`, `GET /api/politicians` (= `/api/representatives`)
- Shares: `GET /api/shares/targets` (staff: their leader; leader: their active staff; admin: empty), `GET /api/shares/inbox|sent|unread-count` (`sent` = everything for admin), `POST /api/shares` (admin 403; `all_mlas`/`district` always 403), `PATCH /api/shares/{id}/status` and `POST /api/shares/{id}/replies` (admin 403), `GET /api/shares/{id}/replies`
- Social: `GET /api/social_media`, `GET /api/social_media/stats`, `POST /api/social_media/scrape`
- Mobile: `POST|DELETE /api/devices`
- Saved stories (private reading list, migration 011): `GET /api/saved`, `POST /api/saved` (saving twice is fine), `DELETE /api/saved/{id}` (own only). `GET /api/dashboard` shares block also carries `week` (received / handled / sent / sent_done, last 7 days, real rows only).
- Home: `GET /api/dashboard` (shape depends on role: admin = system/attention/users/shares/leaders/activity; leaders = news/shares/team; staff = news/shares/leader)
- Ops: `GET /api/health` (no token), `GET /api/automation/status`, `POST /api/automation/trigger` (admin)
- Account: `POST /api/me/password` (change my own password; ends all other sessions), `GET|PUT /api/me/profile` (email, phone, alerts on/off, language), `POST /api/me/test-alert`, `GET /api/briefing?lang=` (+ `POST /api/briefing/email-me`)
- Feedback: `POST /api/feedback/story` (not relevant / wrong priority / wrong tone), `POST /api/feedback/app` (free text for the pilot)
- Admin: `GET /api/audit?limit&q&action` (who did what), `POST /api/representatives/import?dry_run=` (CSV of real contacts + CM / ministers)
- Watchlist (migration `012_tasks.sql`): staff manage names with `GET|POST /api/watchlist`; `POST /api/watchlist/check-now` performs an immediate scan; the background scan runs every 30 minutes when schedulers are enabled. Staff see their office's saved matches, leaders see their own office read-only, and admin sees matches across offices read-only.
- Portfolio: `GET /api/portfolio` (staff + their leader only), `PUT /api/portfolio` (staff only; published office content). Migration `014_official_portfolios.sql` stores team-scoped JSONB content and editor/timestamp metadata. `services/recommendation_service.py` uses the configured Gemini model to suggest grounded next steps from real priority stories, with a deterministic fallback when Gemini is unavailable; watchlist suggestions remain rule-based. Migration `015_suggestion_assignment.sql` stores which active team member received an assigned follow-up.
- (The old unscoped Tasks API was REMOVED 2026-11-14; nothing used it.)

## 7. Data and pipeline
- Migrations 000-004 (004 = share pair guard). `./local.sh start` re-applies them every time (safe).
- Tables: `users` (+`is_active`, `mla_username`), `political_representatives` (119 MLAs seeded from `constituency_mappings.py`), `new_articles` (live, 60 days), `archive_news` (older, kept forever), `social_media_posts`, `shares`, `share_recipients`, `share_replies`, `refresh_tokens`, `device_tokens`, `tasks`, `translations_cache`, `gemini_embeddings_cache`.
- Migrations `backend/migrations/000-003` (safe to re-run); apply with `backend/scripts/apply_migrations.py`.
- Scraper: runs 5 s after backend start, then every 3 h, inside the backend (so run ONE process). 3 collectors (Google News RSS per district/constituency, publisher RSS, publisher sites) -> filter non-Telangana / sports / cinema -> cluster duplicates (same story in several outlets becomes one card with "+N outlets") -> store. One cycle: ~2,800 raw items -> ~1,950 stories in ~2 min, 33 districts. Gemini key is optional (better duplicate matching + AI summaries only; it does not affect the news tone; rule-based fallback without it).
- Unknown stays unknown: no seeded posts, no random numbers, no invented contacts.

## 8. How to run (local)
`./local.sh setup` (once) -> `./local.sh admin --generate` or `./local.sh admin` in a real terminal -> `./local.sh start` -> http://127.0.0.1:8000. Also `stop | status | logs`. `./local.sh demo` makes 7 demo logins (demo_admin, demo_mla + 2 staff, demo_minister + 2 staff) with random passwords saved to `~/.config/ai-smart-office/demo-logins.txt` (private); `./local.sh demo --remove` deletes them. The demo MLA is Kothagudem and carries that MLA's real name (the MLA feed is tied to the name).
Config + secrets live OUTSIDE the repo: `~/.config/ai-smart-office/local.env`. Own Postgres container `ai-smart-office-db-1` on 127.0.0.1:5440. Tests need a THROWAWAY Postgres (see header of `backend/tests/test_shares.py`); they drop tables, never point them at the real DB. Server deploy steps: `docs/DEPLOY.md`.

## 9. Audit (2026-11-13): what is solid, what is open
Solid: build clean; 108 backend tests + 44 saved browser checks (`./local.sh test-ui`, pass in Chrome AND Firefox); no known vulnerabilities in backend or frontend dependencies (pip-audit, npm audit); all screens pass the axe accessibility scan (WCAG 2.1 A/AA) in English and Telugu; Content-Security-Policy active with zero violations; load test 50 users: 59 requests/s, 0 errors, dashboard p50 58 ms / p95 177 ms; scope and role rules enforced server-side; login lockout stored in the database; token-only auth; honest data; fresh-DB setup tested end to end; responsive at 375 / 768 / 1440 px.

Open items, most important first:
1. ~~No language switch~~ DONE 2026-11-14: **English / తెలుగు button in the header** (choice is remembered). Covers the header, tabs, all four Home screens, the share window, the inbox drawer and the team window. The older News feed screens use their existing Telugu dictionary (`utils/constants.js`). NOT translated: the Users window (admin only), the login screen, and server error messages. Telugu wording was written by the assistant: ask a Telugu speaker to review it.
2. ~~Tasks API~~ REMOVED (it was unscoped and unused).
3. ~~No audit log~~ DONE: `audit_log` table + Control Room "Recent activity" + searchable Activity log dialog (logins, failed logins, password changes/resets, user create/disable/enable, shares, status changes, feedback, contact imports).
4. ~~Admin Users screen~~ DONE 2026-11-14: list, search, reset, disable/enable.
5. ~~Password reset did not end sessions~~ DONE: a token issued before `users.password_changed_at` is rejected, so a password change or admin reset logs out every other session.
6. **Real MLA contact details and the CM / ministers still have to be supplied by the user.** The importer is built (Users > Import contacts, CSV, preview before apply). Until then the panel shows "Not available". Nothing is invented.
7. **Social media = public mentions only**, no engagement numbers (would need a paid API and keys).
8. ~~Admin nudge~~ DONE as email: the admin is emailed once when a share sits unopened for 24 h (needs SMTP).
9. **Hardening:** CSP, DB-backed lockout, backups (`./local.sh backup`, `restore-check`), dependency fixes, accessibility and load test are DONE. Still open: uptime monitoring from OUTSIDE the server, Safari/WebKit not tested, HTTPS must be provided by the host when deployed.
10. **News accuracy.** Tone is decided when a story is stored, by keyword rules (positive is the fallback). A 100-story spot check found the 3 "urgent" labels all genuine (death/accident only) but clearly negative headlines often shown as positive. Done so far: extra Telugu negative words; Kashmir/Ladakh, sports-tournament and crop-price filters; an honest **"neutral" option, OFF by default** (`SENTIMENT_NEUTRAL_FALLBACK=true`: neutral unless a clearly positive word; neutral stories show under All News only, no badge; measured on 2,595 real stories: 74% neutral, 9% positive, 14% negative); `backend/scripts/relabel_sentiment.py` (DRY RUN unless `--apply`); an **opt-in free local AI** via Ollama (`OLLAMA_MODEL=...`, see `docs/LOCAL_AI.md`; `./local.sh ollama-check`). **CORRECTION: a Gemini key does NOT change the tone.** `analyze_article_sentiment` (Gemini) exists in `sentiment_service.py` but the live pipeline never calls it; Gemini is only used for duplicate matching and summaries. THE USER STILL CHOOSES: keep the rules, switch neutral on, and/or enable the local AI after measuring it with the Report button and `scripts/quality_sample.py` / `quality_score.py`. Existing stories were NOT relabelled.
11. **Mobile app** (`mobile/app`): Phase 2 parity done (M7-M12.1): single login, change-password, role homes, news parity (scope tabs, Latest/Archive, refresh), team board + my-team, admin users lite. M13.2 accessibility + Telugu clipping pass done. Type-check + lint clean. NOT run on a real device yet (M13.1) and EAS preview build (M13.4) waits for the user's yes.
12. **Deploy is skipped for now** (user decision 2026-11-14). Mobile work is RESUMED (Phase 2, M7-M13.2 done). The web app runs locally via `./local.sh`.

## Front-end stack notes (read before touching CSS)
- Old screens = plain CSS (`frontend/styles.css`, `src/*.css`). New dashboards = **shadcn/ui + Tailwind v4**, components in `src/components/ui/` (installed with the official shadcn CLI: card, badge, button, table, separator, alert), screens in `src/components/home/`. Add more with `npx shadcn@latest add <name> -y` (then fix any `from "cn"` import to `@/lib/utils`).
- Tailwind is **scoped**: `src/shadcn.css` imports only theme + utilities (no global preflight), variables live under `.shadcn-scope`; every new page root must carry class `shadcn-scope` (the `Page` component does).
- GOTCHA: unlayered CSS beats Tailwind's layered utilities. The old `* { margin:0; padding:0 }` reset was moved into `@layer base` in `styles.css` so spacing utilities work. Do not add new unlayered global element/`*` rules.

## UI / UX layer (2026-11-14)
- Windows are shadcn **Dialog** (share, team, users) and **Sheet** (shared inbox drawer, slides in from the right): focus is trapped, Esc closes, they sit above the header (`z-[3000]`), and the scope class is on the content because Radix renders them in a portal outside `.shadcn-scope`.
- Language: `src/i18n/strings.js` (en + te, same keys, 200+ strings), `LangContext.jsx` gives `tr(key, vars)`, `useTimeAgo()`, `useTimeUntil()`. Add a string to BOTH languages. Server "needs attention" items carry `code` + `params` so the screen can translate them (`attn.<code>` keys); `text` stays as English fallback.
- Loading uses skeletons (`HomeSkeleton`); lists on Home are clickable (open the inbox); header buttons are shadcn buttons with icons. `share-styles.css` now only holds the news-card Share button.
- Checked in a real browser: all 7 demo logins + test accounts, English and Telugu, desktop and 375 px phone, no page errors.

## Roadmap work completed 2026-11-14 (see docs/ROADMAP.md)
- **Account dialog** (person icon in the header): contact email + phone, alerts on/off, email language, "send me a test email", browser pop-ups while the app is open, and Change password. **Briefing** button on every Home (copy-and-paste text, or email it to me). **Feedback** button (message icon) reaches the admin's Control Room. **Report** flag on every story.
- **Email alerts** (`services/alerts_service.py`, `notify_service.py`): urgent share -> receiver; stale news and 24 h-unopened share -> admins; morning briefing at `BRIEFING_HOUR` (default 7, Asia/Kolkata) -> everyone with an email. OFF until `SMTP_HOST` + `SMTP_FROM` are set. Send-once via `notification_log`. A failing mail server never breaks the action. WhatsApp / phone push are NOT built (need a provider account).
- **Control Room extras:** News quality card (reports by kind + most reported stories), User feedback card, Recent activity.
- **Performance:** per-scope shared cache (`core/ttl_cache.py`, 60 s for dashboards, 20 s for feeds, single-flight) and a faster duplicate-removal step (identical output, ~3x cheaper).
- **Migrations 005 (audit + password age) and 006 (contacts, alerts, feedback) are applied** by `./local.sh start`.

## Phase 4 close-out tools (2026-11-14)
- `./local.sh email-setup | email-test` (docs/EMAIL_SETUP.md), `./local.sh contacts-sheet`, `./local.sh telugu-review export|import`, `./local.sh watchdog`, `backend/scripts/relabel_sentiment.py`.
- Briefing dialog has **Send via WhatsApp** (opens WhatsApp with the text ready; the person taps Send; no account or API).
- Contact importer skips unfilled rows quietly (`skipped_blank`) and the Import tab has **Download template**.
- Safari/WebKit: the saved browser tests support `E2E_BROWSER=webkit` but WebKit cannot run on this Linux machine (missing system libraries). Run `E2E_BROWSER=webkit ./local.sh test-ui` on a Mac, or open the app in Safari and click through docs/PILOT.md.

## Local AI for news tone (opt-in, 2026-11-14)
`services/sentiment_service.py: classify_tone()` is the one place tone is decided for NEW stories (called from `main_pipeline.py`). With `OLLAMA_MODEL` empty (default) it is exactly the keyword rules. With a model set it asks the local Ollama server one word per new story (POSITIVE / NEGATIVE / NEUTRAL) and falls back to the rules on ANY problem: off, down, slow (timeout), unclear answer, over budget. Safety limits per scrape cycle: max `OLLAMA_MAX_PER_CYCLE` stories (400), max `OLLAMA_MAX_SECONDS_PER_CYCLE` seconds (600), stop after 3 failures in a row; urgent (priority 1) stories are never sent to the model or downgraded; AI "neutral" only counts when `SENTIMENT_NEUTRAL_FALLBACK=true`. Nothing leaves the machine. Tested with a fake Ollama server (11 tests). No model is installed on this machine yet and none was downloaded: the user decides (`./local.sh ollama-check` lists suggestions and sizes).

## Sign-in screen (redesigned 2026-11-14)
`src/components/LoginModal.jsx`: a split page (dark brand panel with 3 value points on wide screens, clean form on the right; stacked with a small brand header on phones). Username + password with icons, **show/hide password**, **Caps Lock warning**, autofocus, correct browser autofill hints, a **language switch** (English / Telugu, remembered), loading state, and precise messages: both fields needed / wrong username or password / **too many wrong attempts, wait 15 minutes** (server answers 429) / cannot reach the server / "your session ended" after an expiry. All text is in `src/i18n/strings.js` (`login.*`). Accessibility scan clean (desktop, phone, error state, Telugu, password shown). GOTCHA: the old stylesheet has a global `.hidden { display:none !important }`, so use `max-lg:hidden`-style classes, never a bare `hidden`, in the new Tailwind screens. 10 saved browser checks cover it (`e2e/flows.cjs`, "Sign-in screen").


## Team-first features (2026-11-15; Phase 5 of docs/ROADMAP.md)
Idea: the STAFF are the leader's IT team and do the daily work; leaders only look. A **team** = one MLA/minister + the staff whose `mla_username` is that leader. The master admin has no team (403).
- **Leader home** (look-only): 3 big numbers, "Picked for you" (= the leader's inbox, one-tap Seen / I'll act / Done), top-5 attention stories, one slim line "N active staff · team task counts · Team tasks · Manage".
- **Team board** (header button `#btn-board` for leader/minister/staff; staff home section "Team tasks" + `#btn-open-board`; "Make a task" on a story row). Columns To do / Doing / Done. Staff add tasks (title, person, due date, note, optional story link), move them, reassign. Leader reads the board and can write notes, nothing else. Notes on each task: staff to staff and leader, same team only. Overdue badge when the due date has passed.
- **Staff-edited briefing**: staff open Briefing, see the LEADER's briefing for today in an editable box, **Save for leader** (valid for today, per language) or **Back to automatic**. The leader's briefing (screen, email-me, scheduled email) then uses the staff text; the leader sees "Your team edited this briefing (name)". Other leaders and staff's own briefing are untouched.
- **Rules enforced in 3 places** (API, `team_repository` scoping by the leader taken from the login, and DB triggers in migration 007: `enforce_task_team`, `enforce_task_note_team`, `enforce_briefing_edit_team` via `in_team()`): tasks/notes/briefing edits only for people in the same team; assignees must be ACTIVE team members. Sharing (staff -> own leader, leader -> own staff) is unchanged: tasks are NOT shares.
- **API**: `GET /api/board`, `POST /api/board/tasks` (staff), `PATCH /api/board/tasks/{id}` (staff), `GET|POST /api/board/tasks/{id}/notes` (team), `GET|PUT|DELETE /api/team/briefing` (staff). Dashboards (`staff`, `mla`, `minister`) carry `board:{todo,doing,done,mine,overdue}`. Audit actions: `task_created`, `task_updated`, `briefing_edited`, `briefing_reset`.
- Tables (migration 007): `team_tasks`, `team_task_notes`, `briefing_edits`.
- **Logo**: one file, `frontend/public/logo.svg`, shown by `components/Logo.jsx` on the sign-in page and the header, and as the browser-tab icon. Replace that file to change it everywhere (keep it square, works at 32 px).
- **Task email (2026-11-15)**: when a task is given to ANOTHER person, they get one email (English or Telugu, their own setting), only if the app has an email sender and they have an address and alerts on. Once per (task, person); a failing mail never breaks the task. Per-team sender accounts are planned later (ROADMAP Phase 6); today ONE app sender is used.
- **Checked**: accessibility scan (WCAG 2 A/AA) clean on leader home, leader board, leader briefing, staff home, staff board, staff briefing editor and leader home at phone width. Run it again with `AXE_PATH=<axe.min.js> E2E_SHOTS=<folder> ./local.sh test-ui` (also saves screenshots).

## Real logins (2026-11-15)
Demo accounts were removed. Real team created with `./local.sh team --constituency Vemulawada --leader aadi_srinivas --staff aadi_staff1 aadi_staff2`: MLA Aadi Srinivas (INC, Vemulawada, Rajanna Sircilla) + 2 staff linked to him only. Passwords: random, in the private file `~/.config/ai-smart-office/team-logins.txt` (mode 600; never in the repo or chat). Master admin login: `admin` (`admin-login.txt`). `create_team.py` never touches an existing username; add more teams the same way, or add staff from the leader's Team screen.

## Milestone 1 office role split (2026-11-24)

The staff role is the **office operations desk**. Staff monitor constituency stories and the watchlist, route WhatsApp messages, draft and schedule posts, update project records, work on team tasks, review public feedback, export saved posts to PDF, and send items to their leader. Staff-created posts wait for leader approval.

The MLA/minister role is the **leader decision page**. Leaders review and approve/reject staff post drafts, act on staff shares and urgent stories, review suggestions and their office's watchlist matches, and oversee projects and team progress. Leaders do not manage the watchlist, submit WhatsApp uploads, create post drafts, or edit project records in the web UI.

The master admin remains the **system control room** and can inspect project, WhatsApp, and cross-office watchlist activity. Write permissions for watchlists, post creation/decision, project updates, and WhatsApp intake are enforced by the API, not only hidden in the interface. Public feedback is submitted without login at `/survey` (also linked from sign-in); staff review the response inbox on their operations home.

## Staff home and post media update (2026-11-24)
- Staff Home now puts its daily create/update actions at the top, followed by work status, story review, feedback, team messages, and office tools. The urgent strip only includes priority-1 items within the selected constituency.
- Compose and schedule accepts one JPEG, PNG, or WebP attachment up to 2 MB. The image is stored with the post and appears in the staff list and leader approval queue. Migration `013_composed_post_image.sql` adds the optional media column.
