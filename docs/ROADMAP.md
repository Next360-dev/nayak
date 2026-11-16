# Roadmap: what was missing, in 3 phases (planned and worked through 2026-11-14)

**STATUS 2026-11-14:** Phase 1 DONE. Phase 2 DONE except actually sending to a phone (needs an email account you create; WhatsApp not built) and real contact data (importer ready). Phase 3: hardening, accessibility, load test, dependency fixes, Chrome + Firefox tests DONE; the PILOT itself (needs real people for a week, see docs/PILOT.md), a native Telugu review, and Safari/WebKit testing are NOT done. Deploy and mobile stay paused.

Deploy and the mobile app stay PAUSED (user decision). Time estimates are my judgment, not measured.
Rule for every phase: write the tests first or alongside, run the browser check, update `docs/PRODUCT_MAP.md`, and stop for the user's "continue" before the next phase.

---------------------------------------------------------------------------------------------------

## Phase 1: Safe to hand to real people (about 1 day, low risk, no new accounts or costs)
Goal: nobody is locked out, nothing can be lost, and every change can be traced.

| # | Item | What gets built | Done when |
|---|---|---|---|
| 1.1 | **Change my own password** | "Change password" in the header menu (old + new password). Migration 005 adds `users.password_changed_at`; a token issued before it is rejected, so a password change or an admin reset also ends old logins (closes the "reset does not end a session" gap). | A user changes their password and their other open sessions are logged out; tests cover both. |
| 1.2 | **Audit log** | Table `audit_log` (who, action, target, when). Records: logins that fail, user create / reset / disable / enable, share created, share status change. Shown to the admin as "Recent activity" on the Control Room, plus a searchable list. | "Who disabled this login and when?" has an answer on screen. |
| 1.3 | **Backups** | `./local.sh backup` (pg_dump into `~/ai-smart-office-backups`, keeps the last 14) and `./local.sh restore <file>`. Restore is proven on a throwaway database. Scheduling it daily is a standing config, so I ask first. | A backup is restored into an empty database and the app works on it. |
| 1.4 | **Screen tests in the repo** | My browser checks become a saved suite (`e2e/`, run with `./local.sh test-ui`) so later changes cannot silently break a screen. | One command runs all role flows in English and Telugu. |

## Phase 2: Reach people, and prove the news is right (about 2 to 3 days)
Goal: an urgent story reaches the right person even when the page is closed, and we know how accurate the news is.

| # | Item | What gets built | Done when |
|---|---|---|---|
| 2.1 | **Alerts outside the app** | One delivery channel (email, WhatsApp or browser push: the user chooses). Used for: an urgent share arrives (to the receiver), the scraper stops or news goes stale (to the admin), a leader leaves a share unopened for a day (to the admin). Each user can set their contact and turn alerts on or off. | An urgent share reaches a phone within about a minute; a stopped scraper messages the admin. |
| 2.2 | **Daily briefing** | Every morning, each leader gets their top stories in their own scope (same logic as their Home), in their language, by the chosen channel, and as a "Briefing" card on Home. | The 7 am message arrives and matches what Home shows. |
| 2.3 | **News quality loop** | "Not relevant" and "Wrong priority" buttons on stories. Stored in `story_feedback`. Admin sees the counts. A script draws 100 random stories for hand-checking and reports how accurate "urgent" and "negative" are. Then tune the rules. | We have an accuracy number for "urgent" and "negative" and a target (for example at least 85% right on urgent). |
| 2.4 | **Missing people data** | Admin can upload a CSV of MLA phone and email (shown instead of "Not available"). A table for the CM and ministers' profiles. Only real data supplied by the user: nothing invented. | Contact details show on the MLA cards and in the briefing. |

Needs the user first: which channel (and who pays or creates the account), real contact data, and the people to include in Phase 3.

## Phase 3: Real-world proof and hardening (about 1 week, mostly calendar time)
Goal: real people use it for a week and nothing important is left to luck.

| # | Item | What gets done | Done when |
|---|---|---|---|
| 3.1 | **Pilot** | 2 or 3 real users (one MLA's team, the minister's team, one admin helper) use it for a week. A short feedback session each. Fix the top confusions. A native Telugu speaker reviews the Telugu wording. | Pilot users do their daily job without help; the top 5 complaints are fixed. |
| 3.2 | **Hardening** | Content-Security-Policy header; lockout counters stored in the database; HTTPS requirement written into the deploy guide; dependency vulnerability scan; accessibility pass (keyboard + contrast); browser checks (Chrome, Firefox, Safari, Android Chrome); a load test with about 50 users at once. | No high or critical findings; the load test is within a set limit (page under 2 s). |
| 3.3 | **Decide the loose ends** | Social media: keep (public mentions only) or pay for a real API. Tasks: build a per-leader task list or remove the unused API. | Each one is either built or deleted. |
| 3.4 | **Re-open the paused items** | Only now: choose hosting and deploy; update the mobile app (new sharing rules already done, add push alerts) and test it on a phone. | The user decides yes or later. |

---------------------------------------------------------------------------------------------------

## Order of work and why
Phase 1 first: it protects data and people and needs nothing from the user. Phase 2 needs the user's decisions (channel, data). Phase 3 needs real people's time. Do not start deploying before the pilot (3.1) is finished.

## Open decisions (the user's)
1. Alert channel: email, WhatsApp, or browser push? Who creates and pays for the account?
2. Who are the 2 or 3 pilot users, and when?
3. Is a daily briefing wanted, and at what time?
4. Real MLA contact data and the CM / ministers list: where will it come from?

---------------------------------------------------------------------------------------------------

## Phase 4: Close-out (planned and worked through 2026-11-14)
Everything still open after Phases 1 to 3. Each row says what I BUILT so the part that needs a person is as small as possible.

| # | Open item | Who must act | What I build now (so that step is tiny) | Status |
|---|---|---|---|---|
| 4.1 | Email account for alerts | You (create the account) | `./local.sh email-setup` (asks 5 things, saves them privately, sends a test) + `./local.sh email-test <address>` + a plain-words walkthrough `docs/EMAIL_SETUP.md` | see STATUS below |
| 4.2 | Real MLA phone + email, CM and ministers | You (the numbers) | `./local.sh contacts-sheet`: a ready CSV of all 119 MLAs with name + constituency already filled and phone/email blank; the import screen gets a "Download template" button | see STATUS below |
| 4.3 | News tone is weak (positive by default) | You (the choice) | (a) honest "neutral" option, OFF by default; (b) relabel script (dry run unless `--apply`); (c) **free local AI via Ollama, opt-in** with strict safety limits, a `./local.sh ollama-check` self-test, and `docs/LOCAL_AI.md`. NOTE: a Gemini key does NOT change the tone (the live pipeline never calls it). | DONE as options; your choice |
| 4.4 | Telugu wording review | A Telugu speaker | `./local.sh telugu-review export` makes a sheet (English next to Telugu); they fix the wrong ones; `telugu-review import` puts the corrections into the app | see STATUS below |
| 4.5 | Reach people who do not use email | (provider account needed for real push) | A "Send via WhatsApp" button on the Briefing that opens WhatsApp with the text ready (no account needed; the person taps Send) | see STATUS below |
| 4.6 | Nobody is told if the whole server is down | You (turn on the schedule) | `./local.sh watchdog` (checks the health address; emails you after 2 failures; emails again when it recovers) + the exact cron line | see STATUS below |
| 4.7 | Safari not tested | Safari on a Mac/iPhone for a real check | Try the WebKit engine in the saved browser tests here | see STATUS below |
| 4.8 | The pilot week | Real people | Already prepared: `docs/PILOT.md` | waits for people |
| 4.9 | Social media is public mentions only | You (a paid service) | Nothing to build: decision recorded (keep as is) | decision |
| 4.10 | Deploy + mobile app | You | Paused by you | paused |

**PHASE 4 STATUS 2026-11-14:**
- 4.1 DONE (tools + walkthrough; the account itself is yours to create). 4.2 DONE (`~/ai-smart-office-contacts.csv` ready to fill; numbers are yours). 4.3 DONE as an option, OFF by default (your choice; measured effect above). 4.4 DONE (`~/ai-smart-office-telugu-review.csv` ready for a Telugu speaker). 4.5 DONE (WhatsApp button; real push still needs a provider). 4.6 DONE (turn on the cron line). 4.7 PARTLY: Chrome + Firefox pass; Safari engine cannot run on this machine. 4.8 waits for people. 4.9 recorded: keep as is. 4.10 paused.

**Correction 2026-11-14:** earlier text in this plan and in the pilot guide said a Gemini key would improve the tone. That was wrong for the live pipeline (see PRODUCT_MAP item 10). The real options are: keyword rules + the Report button, the neutral option, and the opt-in local AI.

---------------------------------------------------------------------------------------------------

## Phase 5: Team-first (decided 2026-11-15)
User decision: the staff are the leader's IT team and do the daily work; leaders have little time and technical background and only look. So: staff get the tools, leaders get a very simple screen. Decisions: staff may talk to each other **inside the same leader's team only**; leader home opens in **English** (Telugu one tap away).

| Step | What | Status |
|---|---|---|
| 5.1 | Leader home: 3 big numbers + "Picked for you" with one-tap Seen / I'll act / Done | DONE 2026-11-15 (60/60 browser checks, 129 backend tests) |
| 5.2 | Staff task board (story -> task, person, due date, To do / Doing / Done), team only | DONE 2026-11-15 |
| 5.3 | Team notes on a task (staff to staff + leader, same team only; DB guard in migration 007) | DONE 2026-11-15 |
| 5.4 | Staff edit the morning briefing before it goes to the leader | DONE 2026-11-15 (138 backend tests, 79/79 browser checks in Chrome and Firefox) |

## Phase 6: later, when real teams ask (decided 2026-11-15, NOT built)
User decision: keep ONE app email sender for now (each person still receives on their own email). Planned for later: **each MLA/minister team can send from its own email account.**
Needs: a "Team email" setting (server, port, user, app password), the password stored ENCRYPTED in the database (key kept outside the repo), fallback to the app sender, a "send test" button, and a rule for who may change it (leader only). Risks to design for: secrets in the database, wrong setup silently stopping a team's alerts (show a clear warning on the Control Room).
Also noted: moving to a custom-domain sender instead of a Gmail needs a domain (costs money: user's call).
