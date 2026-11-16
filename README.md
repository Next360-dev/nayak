# Nayak

**A governance desk for Telangana leaders and the teams who work for them.**
Nayak collects public news, tags it to the right constituency and leader, and gives every login a screen built for what that person does.

> **CONFIDENTIAL AND PROPRIETARY. All rights reserved.** This repository is shared for review only. Viewing it grants no
> license to use, copy, deploy, fork, or build on any part of it. See [LICENSE](LICENSE). Contact: gunny9700@gmail.com

---

## What it does

Leaders (MLAs, MPs, ministers) have little time. Their **staff** do the daily work. Nayak is built around that split:

1. **The news engine** gathers stories from Google News, publisher feeds and local sites. Each run looks back **48 hours**. Repeats are merged, nothing is overwritten, and stories are kept for 60 days.
2. **Tagging** ties each story to a district, a constituency and a leader. A leader's seat can be one constituency (an MLA) or an **area of several** (an MP's Lok Sabha seat).
3. **Staff** review the queue, send stories to their leader, make tasks for the team and edit the morning briefing.
4. **The leader** looks, answers with one tap, and reads the briefing. No typing needed.
5. **The master admin** watches the health of the whole system and never shares or edits team work.

| Login | Home screen | Sees | Does |
|---|---|---|---|
| Master admin | **Control Room** | the whole system | checks health, supports people, reads all activity (read-only) |
| MLA / MP | **My Constituency** | their own seat | looks, replies with one tap, reads notes from the team |
| Minister | **State Overview** | the whole state | same, plus a district watch-list |
| Staff | **Work Queue** | their leader's seat | finds stories, sends them up, runs the team board |

Latest news is a rolling **last 24 hours**. The **Archive** holds everything older. A **Refresh news** button lets a team fetch its own constituency in about 3 seconds instead of waiting for the next 3-hourly run. English and Telugu throughout.

## How it is built

```
Browser (React + Vite + Tailwind/shadcn)
   │  /api/*  (Bearer token)
FastAPI  ──  routes → dependencies → services (the rules) → repositories (SQL)
   │                                              │
   │                                    PostgreSQL 16 (+ triggers that enforce team walls)
   └── news engine thread (3 collectors → de-duplication → tone rules → storage), one process only
```

- **Plain rules, no AI model required.** Tone, priority and tagging are rule-based Python. Local or hosted models are optional switches.
- **Security by layers.** Roles are re-read from the database on every request. Staff share only with their own leader, and database triggers enforce it as well as the service code. Login is a signed token with lockout after repeated failures.
- **Honest data.** Unknown stays unknown: no invented posts, numbers, phone numbers or emails. Blanks read "Not available".

## Run it locally

```
./local.sh setup      # once: private database, tables, the 119 MLAs, web build
./local.sh admin      # create your admin login (hidden password prompt)
./local.sh start      # open http://127.0.0.1:8000
```

Settings and passwords live in `~/.config/ai-smart-office/`, **outside** this folder. Never put a secret in the project.

<details>
<summary><b>All <code>./local.sh</code> commands</b></summary>

| Command | What it does |
|---|---|
| `start` / `stop` / `status` / `logs` | run the app and look at it |
| `team --constituency <Name> --leader <user> --staff <user>...` | create a real leader login and their staff |
| `backup` / `restore-check <file>` / `restore <file> --yes` | save, prove, or restore the database |
| `predeploy` | is it safe to put online? (PASS / WARN / FAIL) |
| `email-setup` / `email-test <address>` | turn on email alerts and the morning briefing |
| `contacts-sheet` | CSV of leaders to fill with real phone/email, then import in the app |
| `telugu-review export` / `import <file>` | a sheet for a Telugu speaker to correct the wording |
| `ollama-check [model]` | is the optional local AI ready? |
| `watchdog` | emails you if the app is down |
| `test-ui` | the saved browser tests on a throwaway database |
| `demo` / `demo --remove` | demo logins for every level |

</details>

## Quality checks

| Suite | What it covers | Count |
|---|---|---|
| Backend (`pytest`) | role walls, team walls, database triggers, news windows, refresh limits, areas | 156 |
| Browser (Playwright, Chrome + Firefox) | every role in English and Telugu, phone width, security headers, accessibility scan | 89 |

```
cd backend && ASO_TEST_DB=1 DB_HOST=127.0.0.1 DB_PORT=55432 DB_NAME=aso_test DB_USER=postgres \
  DB_PASSWORD=<throwaway> JWT_SECRET=<any long text> venv/bin/python -m pytest tests -q
./local.sh test-ui
```

Tests drop tables. Point them only at a **throwaway** Postgres, never your real database.

## Project layout

```
backend/    FastAPI + PostgreSQL: app/ (routes, services, repositories), migrations/, scripts/, tests/
frontend/   React + Vite: src/components/home (the home screens), src/components/ui (shadcn), src/i18n (English/Telugu)
e2e/        saved browser tests + load test
deploy/     Caddy HTTPS config for the one-server Docker deploy
docs/       guides (below)
mobile/     Expo app: paused, kept in its own repository
```

## Documentation

| Read | For |
|---|---|
| [`docs/PRODUCT_MAP.md`](docs/PRODUCT_MAP.md) | every feature per login, who can do what, the API list |
| [`docs/PROJECT_GUIDE.md`](docs/PROJECT_GUIDE.md) | the complete tour of front end, back end and database |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | putting it online: Docker, HTTPS, backups |
| [`docs/EMAIL_SETUP.md`](docs/EMAIL_SETUP.md), [`docs/LOCAL_AI.md`](docs/LOCAL_AI.md), [`docs/PILOT.md`](docs/PILOT.md) | email alerts, optional local AI, the one-week pilot |
| [`docs/ROADMAP.md`](docs/ROADMAP.md), [`STATE.md`](STATE.md) | what is done and what is next |

## Rules this project keeps

- Login is a signed Bearer token only. The server ignores any header that claims a role.
- Sharing: staff to their own leader, leaders to their own staff. The master admin never shares.
- One app process only: the news engine lives inside it.
- Nothing is deployed, published, emailed or paid for without the owner's explicit yes.

## License

Proprietary. All rights reserved. See [LICENSE](LICENSE).
