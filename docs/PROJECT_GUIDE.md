# Nayak: the complete guide (front end, back end, database, tools)

Written in simple words so you can explain the project to anyone.
Last checked against the code: 2026-11-15.
For the full list of features and permissions per role, see `docs/PRODUCT_MAP.md`. This guide explains HOW it is built.

---

## 1. What is this project? (30 seconds)

> A news robot collects Telangana news all day, cleans it, and tags each story to the right MLA by matching names and places.
> The web app shows each person only their own area's news.
> **Staff** (the leader's IT team) pick stories, share them up, assign tasks and prepare the morning briefing.
> The **MLA or minister** just looks and taps (Seen / I'll act / Done).
> The **master admin** watches the whole system and helps people, but shares nothing.
> Every important rule is checked twice: in the code and inside the database.

### The four kinds of login
```
                    ┌───────────────────────────┐
                    │  MASTER ADMIN             │  watches everything, read-only
                    │  "Control Room"           │  creates logins, checks health
                    └─────────────┬─────────────┘
                 ┌────────────────┴─────────────────┐
        ┌────────▼────────┐                 ┌───────▼─────────┐
        │  MLA            │                 │  MINISTER       │   LEADERS: look and answer
        │  own area only  │                 │  whole state    │
        └───▲─────────┬───┘                 └───▲─────────┬───┘
   share UP │         │ share DOWN         share UP│        │ share DOWN
        ┌───┴─────────▼───┐                 ┌───┴─────────▼───┐
        │  STAFF of MLA   │                 │ STAFF of MINISTER│  STAFF: the working team
        └─────────────────┘                 └──────────────────┘
```
One login screen. The username decides which home the person sees.

---

## 2. The tech stack (every tool and why)

### Back end (the brain)
| Tool | What it is (simple) | Used for |
|---|---|---|
| **Python 3.14** | The programming language | All server code and the news robot |
| **FastAPI** | A web framework | Builds the "doors" (API endpoints) the browser calls |
| **Uvicorn** | The server program | Runs FastAPI, listens on port 8000 |
| **Pydantic** | An input checker | Rejects bad data early (empty title, wrong date) |
| **psycopg2** | Python-to-database connector | Sends SQL to PostgreSQL |
| **argon2-cffi** | Password scrambler | Stores only a scrambled password, never the real one |
| **PyJWT** | Signed login tickets | The Bearer token (HS256) proves who you are |
| **httpx, requests** | Download tools | Fetch news pages and feeds |
| **feedparser** | RSS reader | Reads newspaper and Google News feeds |
| **BeautifulSoup** | HTML reader | Reads regional pages that have no feed |
| **google-genai (optional)** | Gemini AI | Only for "are these two stories the same?" and short summaries. It does NOT decide tone |
| **Ollama (optional)** | A local AI on your own computer | Optional news-tone helper. Off until you choose a model |
| **SMTP (optional)** | Email sending | Urgent alerts and the daily briefing. Off until you set an email account |

### Database
| Tool | Used for |
|---|---|
| **PostgreSQL 16** | Stores everything (users, news, shares, tasks...) |
| **Docker Compose** | Starts PostgreSQL with one command (`docker-compose.yml`) |
| **SQL migrations** | Numbered files that build the tables, safe to run twice |

### Front end (what people see)
| Tool | What it is | Used for |
|---|---|---|
| **React 18** | UI library | Builds the screens from small pieces called components |
| **Vite 7** | Build tool | Turns the code into the files the browser loads (`npm run build`) |
| **Tailwind CSS v4** | Styling by small classes | Layout, spacing, colours (new screens) |
| **shadcn/ui + Radix UI** | Ready-made accessible parts | Buttons, dialogs, drawers, tables, tabs |
| **lucide-react** | Icon set | All icons |
| **Own CSS (`styles.css`)** | Older hand-written styles | The News feed and header |

### Testing and tools
| Tool | Used for |
|---|---|
| **pytest** | 138 backend tests on a throwaway database |
| **Playwright** (`e2e/`) | 79 browser checks for every role, English and Telugu, in Chrome and Firefox |
| **axe-core** | Accessibility scans |
| **pip-audit / npm audit** | Look for known-vulnerable packages (0 found at last check) |
| **`e2e/load.py`** | Load test (many users at once) |
| **`local.sh`** | One command hub for running, backup, tests |

---

## 3. Map of the whole folder

```
AI_SMART_OFFICE-main/
├── local.sh               ← THE command hub (setup, start, stop, backup, test-ui ...)
├── docker-compose.yml     ← starts the PostgreSQL database
├── run_backend.bat        ← Windows shortcut to start the backend
├── README.md              ← how to run it
├── AGENTS.md              ← rules for any coding assistant working on this project
├── STATE.md               ← current status
├── NOTES.md               ← old history and decisions (read-only memory)
├── backend/               ← the server AND the news robot
├── frontend/              ← the web app people use
├── e2e/                   ← browser tests (Playwright) + load test
├── scripts/               ← telugu_review.py (translation review tool)
├── docs/                  ← written guides (this file, PRODUCT_MAP, ROADMAP ...)
├── mobile/                ← phone app (built, PAUSED by decision)
└── telangana-posts/       ← old saved JSON snapshots of scraped social posts
```

---

## 4. How everything connects

```
 ┌──────────────── NEWS ENGINE (runs by itself, every 3 hours) ────────────────┐
 │ 3 collectors → clean → merge duplicates → tag MLA → label tone → save       │
 └──────────────────────────────────────┬─────────────────────────────────────┘
                                        ▼
                                  ┌──────────┐
                                  │PostgreSQL│
                                  └────┬─────┘
                                       ▲  reads and writes
 ┌─────────────────────── WEB API (FastAPI, port 8000) ────────────────────────┐
 │ login · dashboards · news · shares · team board · briefing · audit          │
 └──────────────────────────────────────┬─────────────────────────────────────┘
                                        │ JSON over HTTP (Bearer token)
                                        ▼
 ┌──────────────────────── WEB APP (React, in the browser) ────────────────────┐
 │ Login → Home (per role) → News feed → drawers and dialogs                   │
 └─────────────────────────────────────────────────────────────────────────────┘
```
The robot and the API never call each other. The robot writes to the database, the API reads it.
In real use, the backend also serves the built web app from `frontend/dist`, so one address (`http://127.0.0.1:8000`) does everything.

### 4a. One request, layer by layer (example: staff shares a story)
```
Browser  ──►  ROUTE        api/routes/shares.py        "a door": checks the data shape
         ──►  DEPS         api/deps.py                 "who are you?": reads the token, loads the user and role from the DB
         ──►  SERVICE      services/share_service.py   "the rules": staff may only share to their own leader
         ──►  REPOSITORY   repositories/share_repository.py   "the SQL": inserts the share
         ──►  DATABASE     trigger enforce_share_pair  "second lock": refuses a wrong pair even if the code had a bug
         ◄──  JSON answer back to the browser
```
Why layers? Each file does one job, so a rule changes in one place and the rest stays safe.

### 4b. Login
1. Browser sends username + password to `POST /api/login`.
2. Server checks the lockout (5 wrong tries in 15 minutes per username + IP, stored in `audit_log`).
3. argon2 compares the password with the stored scramble.
4. Server returns a signed token (valid 8 hours) and the user.
5. The browser keeps the token and sends it as `Authorization: Bearer <token>` on every call.
6. On each call the server re-reads the user's role from the database. Changing a password makes older tokens invalid.
7. Any `401` makes the app clear the token and show the login screen ("your session ended").

### 4c. Share flow
```
Staff taps "Send to MLA" ─► share + recipient saved ─► MLA home shows it under "Picked for you"
MLA taps Seen / I'll act / Done ─► status saved ─► staff see the status on their home
Either side can reply in the thread
```
If the share is urgent and email is set up, the receiver also gets an email (once only).

### 4d. Team board and briefing
```
Staff: Make a task from a story ─► team_tasks row ─► whole team (and the leader) sees it
Staff edits the leader's briefing ─► briefing_edits row (today, one language)
Leader opens Briefing / gets the 7 am email ─► the staff version is used
```

---

## 5. The database (PostgreSQL)

| Table | What it holds |
|---|---|
| `users` | Every login: username, scrambled password, role, area, who they work for (`mla_username`), active or disabled, last login, contact, `password_changed_at` |
| `new_articles` | Today's collected news (title, summary, outlets, district, constituency, tone) |
| `archive_news` | News older than 60 days, moved out of the live table |
| `political_representatives` | The 119 MLAs (name, party, constituency, phone/email when you add them) |
| `shares` | One row per shared story (who sent it, note, priority) |
| `share_recipients` | Who received it and its status: new, seen, acting, done |
| `share_replies` | The reply thread of a share |
| `team_tasks` | Team board tasks (title, person, due date, To do / Doing / Done) |
| `team_task_notes` | Notes written on a task |
| `briefing_edits` | A staff-edited briefing for one leader, one day, one language |
| `social_media_posts` | Public social mentions of MLAs |
| `refresh_tokens`, `device_tokens` | Long phone sessions and push tokens (mobile app) |
| `audit_log` | Who did what and when (also used for login lockout) |
| `story_feedback`, `app_feedback` | "This story is wrong" reports and free-text feedback |
| `notification_log` | Remembers what was already emailed, so nothing is sent twice |
| a translation cache | Remembers translated headlines, so the same text is not translated twice |

### Migrations (the blueprint, applied in order, safe to run twice)
| File | Adds |
|---|---|
| `000_base_schema.sql` | News, representatives, social, translation tables |
| `001_auth_and_shares.sql` | Users, roles, shares, recipients, replies, active flag |
| `002_social_metrics_nullable.sql` | Social numbers may be empty (no invented data) |
| `003_mobile.sql` | Refresh tokens and device tokens |
| `004_share_pair_guard.sql` | **Database lock**: staff can share only to their own leader and leaders only to their own staff |
| `005_audit_and_password_age.sql` | Audit log and the password-age check |
| `006_alerts_feedback.sql` | Contacts, alert switches, send-once log, feedback tables |
| `007_team_board.sql` | Tasks, notes, edited briefings + **database lock**: only the same team |

`backend/scripts/apply_migrations.py` runs them all. `./local.sh start` runs it automatically.

---

## 6. Back end, file by file (`backend/`)

### 6a. Entry and foundation
| File | What it does |
|---|---|
| `app/main.py` | The start of the server. Plugs in all routes, adds security headers (no framing, content-type, Content-Security-Policy), starts the news robot and the alert job, and serves the built web app |
| `app/core/config.py` | Reads settings from the private env file (database, JWT, email, timezone, tone options) |
| `app/core/database.py` | Opens connections to PostgreSQL |
| `app/core/security.py` | Hashes passwords (argon2); creates and checks login tokens |
| `app/core/ttl_cache.py` | A small timed memory with "single flight": if 50 people open Home at once, it is calculated once, not 50 times |
| `app/api/deps.py` | "Who is calling and may they?" for every route. Loads the user from the DB each time; `require_roles(...)` gates routes |

### 6b. Routes ("doors", `app/api/routes/`)
| File | Doors it opens |
|---|---|
| `auth.py` | Login, logout, token refresh, `/api/me`, change my password, admin: create users, reset password, list users, disable or enable |
| `team.py` | Admin control-room data; a leader's own staff: list, add, reset password, disable |
| `dashboard.py` | `/api/dashboard`: each role gets its own home data |
| `news.py` | The news feed with filters, always limited to the person's area |
| `shares.py` | Targets, create share, inbox, sent, unread count, status, replies |
| `board.py` | Team tasks, task notes, and the staff-edited briefing |
| `account.py` | My contact details and alert switches, today's briefing, send-me-a-test-email |
| `audit.py` | The audit log (admin only) |
| `feedback.py` | "Report a story" and app feedback |
| `contacts.py` | Import MLA phone/email from a CSV (admin) |
| `politicians.py` | The MLA directory |
| `translation.py` | Translate a headline and summary (English / Telugu) |
| `social_media.py` | Public social mentions (honest: shows "not available" if no real data) |
| `devices.py` | Register phone push tokens (for the paused mobile app) |

### 6c. Services ("rules and brain", `app/services/`)
| File | What it does |
|---|---|
| `auth_service.py` | Login checks, lockout, token refresh, creating users, "is this person scoped to one area?" |
| `share_service.py` | **The sharing rules** (staff to own leader, leader to own staff, admin never) |
| `dashboard_service.py` | Builds each role's home: admin (system health, attention list, leaders), leader (news, picks, team, tasks), staff (queue, sent, tasks). Uses the shared cache |
| `news_service.py` | Gets news for the person's scope and counts |
| `briefing_service.py` | Writes the morning briefing (English or Telugu) from the same numbers as Home; applies a staff edit for today if one exists |
| `alerts_service.py` | The background job: urgent-share emails, "scraper stopped" alerts to admin, the daily briefing at the set hour |
| `notify_service.py` | Sends one email to one person, at most once per event |
| `sentiment_service.py` | Decides positive, negative or urgent with keyword rules; optional neutral label; optional local AI (Ollama) with safety limits |
| `contacts_service.py` | Reads and checks the contacts CSV (previews problems before applying) |
| `translation_service.py` | Translates through a public web service and caches the result |
| `social_media_service.py` | Social mention data for the API |
| `push_service.py` | Phone push messages (mobile app) |
| `gemini_embedding_service.py`, `gemini_summary_service.py` | Short shortcut files that point to the real Gemini code in `backend/` |

### 6d. Repositories ("only SQL lives here", `app/repositories/`)
`user_repository.py` (users, tokens, staff lists, leader overview), `share_repository.py`, `news_repository.py`, `board_repository.py` (tasks, notes, edited briefings, always filtered by the team), `audit_repository.py` (log + lockout counter), `feedback_repository.py`, `notification_repository.py` (send-once log), `politician_repository.py`, `system_repository.py` (read-only health facts).

### 6e. Other app folders
| Path | What it does |
|---|---|
| `app/schemas/users.py`, `news.py` | Pydantic shapes for requests and answers |
| `app/queries/*.sql` + `loader.py` | Longer SQL kept in files (news, shares, users, politicians, translation, embeddings); the loader reads them by name |
| `automation/manager.py`, `data/*.py` | Tiny shortcut files (5 to 20 lines) that point to the big files in `backend/` |

---

## 7. The news engine (how it finds "his" news)

Runs automatically: first run a few seconds after the server starts, then every **3 hours** (`SCRAPE_INTERVAL_SECONDS`, default 10800).

```
 ① COLLECT ──► ② CLEAN ──► ③ GROUP ──► ④ TAG MLA ──► ⑤ LABEL TONE ──► ⑥ SAVE
```
| Step | File | What happens |
|---|---|---|
| ① Collect | `file1_google_rss.py` | One Google News search per constituency (119), in Telugu and English |
| ① Collect | `file2_publisher_rss.py` | Newspapers' own RSS and sitemaps |
| ① Collect | `file3_html_scrapers.py` | Regional pages with no feed (e.g. a district page) |
| ① Collect | `date_extractor.py` | Finds the real publication date, so old news is not shown as new |
| ② Clean | `deduplication.py` | Throws away non-Telangana and non-governance stories (cricket, films...) |
| ③ Group | `deduplication.py` (+ optional Gemini) | Merges repeated stories into one card ("+3 outlets") |
| ④ Tag MLA | `constituency_mappings.py` | The name list. See below |
| ⑤ Label | `app/services/sentiment_service.py` | Keyword rules decide positive / negative / urgent |
| ⑥ Save | `main_pipeline.py` | The boss: runs steps 1 to 5, stores in `new_articles`, moves news older than 60 days to `archive_news` |
| Timer | `automation_manager.py` | Repeats the whole thing on schedule and keeps a run log |
| Social | `social_media_scraper.py` | Public mentions of MLAs |

### How a story is tied to an MLA (example: Aadi Srinivas, Vemulawada)
`constituency_mappings.py` holds every MLA's name, constituency, mandals and districts in English and Telugu. For each story the engine reads the headline first (it counts most), then the summary:
```
Text contains…                                  → story is tagged to
"Aadi Srinivas" / "ఆది శ్రీనివాస్"                → Vemulawada
"Vemulawada" / "వేములవాడ"                        → Vemulawada
a mandal or town inside that seat               → Vemulawada
a local leader's name                           → that leader's seat
```
Safety rules: a state leader (CM, KCR) is tied to their home seat only if the story is from there or names it; confusing words are on a block-list; a mandal name used in two places needs a second clue; no clue means the story stays **Statewide**.
A story can carry several constituencies. Then the server shows each login only the stories of its own constituency, and forces this on the server, so editing the web address does not help.

### Honest limits of the engine
It matches names and places in words. It does not "understand" a story. A story naming neither the MLA nor the place is not tagged to them. Tone is keyword-based and weak (many negative stories show as positive). A Gemini key does not change tone.

---

## 8. Front end, deep dive (`frontend/`)

### 8a. How the page starts
```
index.html ─► src/main.jsx ─► src/App.jsx ─► (LangProvider) ─► Login or the app
```
- `index.html`: the one HTML page. Has the tab icon (`/logo.svg`).
- `src/main.jsx`: starts React and loads the style files.
- `src/App.jsx` (the big coordinator, ~740 lines): keeps the login token and current user, the language, which view is open (Home or News), which dialogs are open (inbox, team, board, briefing...), the news list and filters, and the unread count. Any `401` event logs the person out.
- `vite.config.js`: while developing, forwards `/api` calls to the backend on port 8000.
- `components.json`, `jsconfig.json`: shadcn and the `@/` short import path.

### 8b. Shared helpers
| File | What it does |
|---|---|
| `src/utils/api.js` | EVERY call to the server lives here (login, news, shares, team, board, briefing...). Adds the Bearer token, turns errors into messages, signals "session expired" on `401` |
| `src/i18n/strings.js` | All text for the new screens in English AND Telugu (same keys in both: 300+) |
| `src/i18n/LangContext.jsx` | `tr('key', {vars})` gives text in the chosen language; also "5 minutes ago" helpers |
| `src/utils/constants.js` | Older text dictionary used by the News feed screens |
| `src/lib/utils.js` | `cn()` for joining CSS class names |
| `src/lib/browserAlerts.js` | Optional "show alerts on this device while the app is open" |

### 8c. Styling (important to know)
| File | Role |
|---|---|
| `styles.css` | Older hand-written CSS (header, News feed). About 2,900 lines |
| `src/shadcn.css` | Tailwind for the NEW screens, kept inside `.shadcn-scope` so it never breaks the old ones |
| `src/share-styles.css`, `src/header-toolbar-styles.css` | Older styles for the share drawer and header bar |

Two traps to remember: old unlayered CSS beats Tailwind classes (so the old reset was moved into a low-priority layer), and a global `.hidden { display:none !important }` exists, so responsive hiding must use `max-lg:hidden`, never the bare `hidden` class.

### 8d. Screens and parts (`src/components/`)
**Entering and the frame**
| File | What it is |
|---|---|
| `LoginModal.jsx` | The sign-in page: brand panel + form, show/hide password, caps-lock warning, clear errors, language button |
| `Logo.jsx` | The logo (one file `public/logo.svg`, replace it to change it everywhere) |
| `Header.jsx` | Top bar: logo, name badge, buttons (Tasks, My team / Users, Shared with unread badge, account, feedback, language, logout) |
| `home/NavTabs.jsx` | The Home / News feed tabs |

**The three homes (`home/`)**
| File | Who sees it | What is on it |
|---|---|---|
| `HomeDashboard.jsx` | everyone | Loads `/api/dashboard` (refreshes every minute) and picks the right home |
| `AdminHome.jsx` | master admin | Control Room: 4 KPI cards, "Needs your attention", system health + "Run news update now", leaders table, recent activity |
| `LeaderHome.jsx` | MLA, minister | Look-only: 3 big numbers, "Picked for you" with one-tap Seen / I'll act / Done, top 5 stories, minister's district table, slim team line |
| `StaffHome.jsx` | staff | Work Queue: numbers, stories to review (Send up / Make a task), Team tasks card, what I sent, from the leader |
| `shared.jsx` | all homes | Page frame, KPI card, section card, empty box, status badge, loading skeleton |
| `StoryRow.jsx` | homes | One story with report, open-link, make-a-task and send buttons |
| `InboxList.jsx` | homes | A short inbox list |

**News feed (the second tab)**
| File | What it is |
|---|---|
| `NewsFeed.jsx` | The feed: paging, scope tabs (all / positive / negative / statewide / civic), loading and empty states |
| `NewsCard.jsx` | One story card: tags, time, outlets, constituency leader, Share, Translate |
| `SidebarFilters.jsx` | Period, district, constituency and MLA filters (locked to the person's area for MLAs and staff) |
| `UrgentAlertBanner.jsx` | The red banner for urgent stories |
| `OutletsModal.jsx` | The "+N outlets" popup listing every newspaper |
| `RepresentativesDirectory.jsx` | The MLA directory |
| `SocialMediaView.jsx` | The social mentions screen |
| `ReportMenu.jsx` | "Not relevant" / "Wrong priority" reporting menu on a story |

**Working together**
| File | What it is |
|---|---|
| `ShareModal.jsx` | The share dialog (pick who, note, urgent) |
| `ShareInbox.jsx` | The Shared drawer: inbox, sent, status buttons, replies |
| `TeamBoard.jsx` | The team task board: add task, three columns, move, assign, notes |
| `BriefingDialog.jsx` | Leaders read it; staff edit it and save for the leader or reset |
| `TeamModal.jsx` | A leader adds, resets and disables their own staff |

**Admin and account**
| File | What it is |
|---|---|
| `AdminUsersModal.jsx` | All users (search, reset password, disable) and create any user |
| `AuditDialog.jsx` | The searchable "who did what" list |
| `AccountDialog.jsx` | My contact details, alert switches, my password |
| `FeedbackDialog.jsx` | Free-text feedback to the admin |

**`components/ui/`**: the shadcn building blocks (alert, badge, button, card, checkbox, dialog, input, label, separator, sheet, skeleton, table, tabs, textarea). Installed with the shadcn tool. Edit with care.

---

## 9. Security (the short list)
1. Passwords are never stored; only the argon2 scramble.
2. Every request carries a signed token; the role is re-read from the database each time; the server ignores any `X-User-*` header.
3. Changing or resetting a password ends older sessions.
4. 5 wrong logins in 15 minutes locks that username + IP for a while (stored in the database).
5. Team and share walls are enforced in the API and by database triggers.
6. Disabled accounts are logged out at once; admin accounts cannot be disabled.
7. Security headers and a Content-Security-Policy are sent on every page.
8. The audit log records logins that fail, user changes, shares, tasks and briefing edits. Passwords and message bodies never go into it.
9. Secrets (`.env`, passwords, keys) stay outside the repository. Private files live in `~/.config/ai-smart-office/`.

---

## 10. Background jobs (start with the server)
| Job | Every | What it does |
|---|---|---|
| News engine | 3 hours | Collect, clean, tag, label, save, archive |
| Alerts job | 10 minutes (`ALERT_CHECK_MINUTES`) | Sends urgent-share emails, warns the admin if news is stale or the scraper stopped, and sends the daily briefing after 7 am (`BRIEFING_HOUR`, Asia/Kolkata) |
| Home refresh (browser) | 1 minute | The open Home screen updates itself |
| `scripts/watchdog.py` (optional, cron) | a few minutes | Lives outside the app; emails you if the whole server is down |

Email only works after you set `SMTP_HOST` and `SMTP_FROM` (`./local.sh email-setup`).

---

## 11. Settings (names only; values stay private)
`DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD` · `JWT_SECRET`, `JWT_EXPIRE_MINUTES` (480) · `SMTP_*` · `APP_BASE_URL` · `ALERT_CHECK_MINUTES` · `BRIEFING_HOUR` · `TIMEZONE` · `SCRAPE_INTERVAL_SECONDS` · `GEMINI_API_KEY`, `GEMINI_MODEL` · `SENTIMENT_NEUTRAL_FALLBACK` (off) · `OLLAMA_MODEL` (off).
Template: `backend/.env.example`. Real file: private.

---

## 12. Commands you will use (`./local.sh`)
| Command | What it does |
|---|---|
| `./local.sh setup` | First-time setup (database, packages, migrations, MLAs) |
| `./local.sh admin` | Create the first admin (type the password in a real terminal) |
| `./local.sh start` / `stop` / `status` / `logs` | Run and watch the app at http://127.0.0.1:8000 |
| `./local.sh demo` / `demo --remove` | Make or delete demo logins for every level |
| `./local.sh backup`, `restore-check`, `restore <file>` | Back up the database; prove a backup restores |
| `./local.sh test-ui` | Run the browser tests on a throwaway database (`E2E_BROWSER=firefox` for Firefox) |
| `./local.sh email-setup`, `email-test <address>` | Turn on and test email |
| `./local.sh contacts-sheet` | Make the MLA contacts CSV to fill in |
| `./local.sh telugu-review export / import` | Round-trip for a Telugu speaker to check wording |
| `./local.sh ollama-check <model>` | Test the optional local AI |
| `./local.sh watchdog` | Run the health watcher once |

Backend tests (throwaway database only): see the header of `backend/tests/test_shares.py`; run from `backend/` with `venv/bin/python -m pytest tests`.

---

## 13. Tests
| Where | What | Count |
|---|---|---|
| `backend/tests/` | Login, roles, sharing rules, database guards, dashboards, team board, briefing, alerts, audit, cache, news filters, tone, contacts, Telugu review, watchdog | 138 |
| `e2e/flows.cjs` | Real browser: sign-in screen, each role's home, share flow, MLA actions, team board and briefing, password change, admin screens, Telugu, phone width, no page errors, no CSP violations | 79 (Chrome and Firefox) |
| `e2e/seed.py`, `run.sh` | Builds the throwaway test database and runs the browser tests | |
| `e2e/load.py` | Load test: many users at once | |

Rule: before saying "done", run `cd frontend && npm run build` and the backend tests.

---

## 14. Scripts (`backend/scripts/` and `scripts/`)
`apply_migrations.py` (build/upgrade tables) · `create_admin.py` · `create_demo_users.py` · `seed_representatives.py` (load the 119 MLAs) · `set_smtp.py` and `email_test.py` · `export_contacts_sheet.py` · `quality_sample.py` and `quality_score.py` (measure how accurate "urgent" and "negative" are) · `relabel_sentiment.py` (re-label old stories; dry run unless `--apply`) · `ollama_check.py` · `watchdog.py` · `purge_fabricated_social_posts.py` · `migrate_sentiment_columns.py` · `update_summaries.py` · `renumber_ids.py` · `scripts/telugu_review.py`.

---

## 15. The docs folder
| File | Read it for |
|---|---|
| `docs/PRODUCT_MAP.md` | Every feature per role, permission table, API list |
| `docs/PROJECT_GUIDE.md` | This guide |
| `docs/ROADMAP.md` | What was missing and the phases that fixed it |
| `docs/PILOT.md` | How to run the one-week trial with real staff |
| `docs/EMAIL_SETUP.md` | Step by step: turn on email alerts |
| `docs/LOCAL_AI.md` | The optional local AI for news tone |
| `docs/DEPLOY.md` | Putting it online (paused) |

---

## 16. Mobile app (`mobile/`)
An Expo / React Native app (code built, **paused by decision**). It uses the same backend: token login, news, shares. Plans in `mobile/PLAN.md` and `mobile/TASKS.md`. The backend already has refresh tokens and device tokens for it. It was written before the team board, so it does not have tasks yet.

---

## 17. Words explained like for a school student
| Word | Meaning |
|---|---|
| **Frontend** | What you see and tap in the browser |
| **Backend** | The server behind the screen that holds the rules and talks to the database |
| **API** | A list of "doors" the front end knocks on to ask for or change data |
| **Endpoint** | One door, like `/api/login` |
| **Database** | A set of tables where all data is stored |
| **Migration** | A numbered file that builds or changes tables |
| **Token (JWT)** | A signed ticket that proves you logged in |
| **Hash** | A one-way scramble of a password, so the real one is never kept |
| **Role** | What kind of user you are: admin, mla, minister, staff |
| **Scope** | The area you are allowed to see |
| **Trigger** | A guard inside the database that checks a rule on every save |
| **Cache** | A short memory that avoids doing the same work again |
| **Scraper / collector** | A program that reads websites for news |
| **Deduplicate** | Merge repeated copies of the same story |
| **Pipeline** | The chain of steps news goes through |
| **Component** | One reusable piece of a web page |
| **Throwaway database** | A temporary test database that is deleted after the test |

---

## 18. Honest status
**Working and tested:** roles and homes, sharing rules, team board, staff-edited briefing, Telugu and English, audit log, backups with restore proof, security headers, accessibility on scanned screens, load test.
**Needs people, not code:** the one-week pilot with real staff; a native Telugu speaker to check the wording; an email account for alerts; real MLA phone/email data and the CM and ministers list; a decision on news tone (keep rules, neutral label, or a local AI model); Safari testing (not possible on this machine).
**Weakest part:** news tone labelling (keyword rules).
**Paused by decision:** the mobile app and putting it online.
