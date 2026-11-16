# Nayak

> **CONFIDENTIAL AND PROPRIETARY. All rights reserved.** This repository is shared for review only. Viewing it grants no
> license to use, copy, deploy, fork, or build on any part of it. See [LICENSE](LICENSE). Contact: gunny9700@gmail.com


Governance news for Telangana, collected automatically, with a **master admin** who watches the whole system and **MLAs and
ministers** who each work with their own **staff team**. News is gathered from public sources every 3 hours, de-duplicated, tagged to
a district / constituency / MLA, and shown in a web app that has a different home screen for each kind of login.

| Login | Home screen | Sees | Does |
|---|---|---|---|
| Master admin | **Control Room** | the whole system | checks health, supports people, reads all activity (read-only), shares nothing |
| MLA | **My Constituency** | only their own constituency | receives from staff, acts, replies, shares down to their staff |
| Minister | **State Overview** | the whole state | same as MLA, plus a district watch-list |
| Staff | **Work Queue** | their leader's scope | finds stories, sends them up to their leader |

English and Telugu (language button in the header).

## Run it on this computer
```
./local.sh setup      # once: private database, tables, the 119 MLAs, web build
./local.sh admin      # in a real terminal: create your admin login   (or: ./local.sh admin --generate)
./local.sh start      # then open http://127.0.0.1:8000
```
Everyday: `./local.sh stop | status | logs | backup | demo` (more in the table below). Settings and passwords live in
`~/.config/ai-smart-office/local.env`, **outside** this folder. Never put a password in the project.

## Commands (`./local.sh ...`)
| Command | What it does |
|---|---|
| `start` / `stop` / `status` / `logs` | run the app and look at it |
| `backup` / `restore-check <file>` / `restore <file> --yes` | save, prove, or restore the database |
| `demo` / `demo --remove` | 7 demo logins (admin, MLA + 2 staff, minister + 2 staff) / delete them |
| `email-setup` / `email-test <address>` | turn on email alerts and the morning briefing |
| `contacts-sheet` | CSV of all MLAs to fill with real phone/email, then import in the app |
| `telugu-review export` / `import <file>` | a sheet for a Telugu speaker to correct the wording |
| `ollama-check [model]` | is the free local AI ready, and is it any good at news tone? |
| `watchdog` | emails you if the app is down (put it in cron) |
| `test-ui` | the saved browser tests on a throwaway database (`E2E_BROWSER=firefox` for Firefox) |

## Read this before changing anything
- **`docs/PRODUCT_MAP.md`**: every feature per login, who can do what, the API list, the data pipeline, open issues. Keep it up to date.
- `STATE.md` current status and history, `AGENTS.md` rules for coding agents, `docs/ROADMAP.md` what was planned and what is left.
- `docs/PILOT.md` the one-week trial with real users, `docs/EMAIL_SETUP.md`, `docs/LOCAL_AI.md`, `docs/DEPLOY.md` (going online).

## Checks
```
cd backend && ASO_TEST_DB=1 DB_HOST=127.0.0.1 DB_PORT=55432 DB_NAME=aso_test DB_USER=postgres DB_PASSWORD=<throwaway> \
  JWT_SECRET=<any long text> venv/bin/python -m pytest tests -q     # needs a THROWAWAY Postgres: tests drop tables
./local.sh test-ui                                                   # browser tests (Chrome; also Firefox)
```
Never point the tests at your real database.

## Project layout
```
backend/    FastAPI + PostgreSQL: app/ (routes, services, repositories), migrations/ (000-006), scripts/, tests/
frontend/   React + Vite: src/components/home (the 4 home screens), src/components/ui (shadcn), src/i18n (English/Telugu)
e2e/        saved browser tests + load test         scripts/   helper scripts (Telugu review)
mobile/     Expo app: PAUSED (written for the older sharing rules; not part of the web release)
docs/       guides above
```

## Rules this project keeps
- **Unknown stays unknown.** No invented posts, numbers, phone numbers or emails; blanks show "Not available".
- Login is a signed Bearer token only; roles and scope are enforced on the server and re-read on every request.
- Sharing: staff to their own leader, leaders to their own staff, the master admin never shares (enforced in the service **and** by a database trigger).
- Nothing is deployed, published, emailed or paid for without the owner's explicit yes.
