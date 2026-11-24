# Mobile milestone spec (for OpenCode). Written 2026-11-24.

Rules: follow `AGENTS.md`. One task at a time. After each: run its checks, tick it in `mobile/TASKS.md`, stop and report.
Never touch a real database (tests: throwaway Postgres, see `backend/tests/test_shares.py` header). Unknown stays unknown. No credit lines for AI tools in commits.
Checks every task: `cd mobile/app && npx tsc --noEmit && npm run lint`; backend tasks also `cd backend && PYTHONPATH=. venv/bin/python -m pytest tests` (ASO_TEST_DB env, see header).
Visual reference: `frontend/src/components/ui/creator-dashboard.tsx` and `ministerial-dashboard.tsx` (drafts, not wired to data). Reference site tokens: bg #F8FAFC, navy #0B132B, saffron #F97316, fonts Plus Jakarta Sans + Space Grotesk.
Mobile code map: screens `mobile/app/app/`, UI kit `mobile/app/src/ui/`, API `mobile/app/src/api/`, tokens `src/theme/index.ts`.

## Track A: bring the web app's features and UX to the phone (do first)
- [ ] A1 Telugu/English UI switch. Add `src/i18n/` (strings + `useLang`), store choice in SecureStore, switch in More. Translate Home, News, Inbox, Team, More first. Accept: toggle flips labels live; Telugu text has line-height >= 1.6 and is not clipped.
- [ ] A2 Urgent alert banner. Horizontal ticker/strip of P1 stories on Home and News (`GET /api/news` priority 1). Tap opens the story. Accept: hidden when none.
- [ ] A3 News filters sheet: district, constituency, priority, search, for statewide users (minister/admin). Scoped users stay pinned (server enforces). Accept: filters change the list; scoped users do not see district/constituency pickers.
- [ ] A4 "+N outlets" sheet on story card/detail (all sources of a story). Accept: lists every publisher with link.
- [ ] A5 Representatives directory screen (More -> Directory): `GET /api/politicians`, search, call/email only when data exists, else "Not available".
- [ ] A6 Admin audit log screen (More -> Activity): `GET /api/audit?limit&q&action`. Admin only.
- [ ] A7 Social tab: platform filter (YouTube/Facebook/Instagram/X), tone filter incl. Neutral, search. Accept: filters work; "showing older" note kept.
- [ ] A8 Visual refresh using the draft dashboards: metric cards, ticker, navy/saffron palette via tokens only (no stray hex). Accept: Home, News, Inbox, Team restyled; dark text contrast >= 4.5:1.

## Track B: milestone features (backend + web + phone each; spec order = build order)
- [ ] B1 Top-5 constituency alerts every 30 min. Backend job picks 5 most urgent/negative stories per constituency, sends push + email to that office's staff (send-once per story; reuse `alerts_service`, `push_service`). Phone: Alerts list on Home. Accept: tests with a fake clock; no duplicate sends.
- [ ] B2 Watchlist of 5 people per office. Table `watchlist(office, name)` max 5, staff edit. Every 30 min crawl each (reuse `social_media_scraper`), alert staff on new posts. Accept: limit 5 enforced; new post alerts once.
- [ ] B3 Post studio. Table `posts` (draft/scheduled/approved/posted), leader approves, schedule time, stored forever. Publishing to platforms is STUBBED ("ready to post" + copy/export) until API keys exist. Staff "Download all" = PDF of every post + crawled item (backend `GET /api/posts/export.pdf`). Accept: PDF contains all rows; role rules enforced.
- [ ] B4 Party WhatsApp intake. Staff paste/upload exported chat or text; rules-based sorter tags topic/urgency; routes to staff + admin inbox. No automatic WhatsApp reading. Accept: tagged items appear in both inboxes.
- [ ] B5 AI inbox for the leader. First version rules-based suggestions built from B1/B2 items ("negative story: assign a staff member"); leader approve/dismiss; AI key later, always human review.
- [ ] B6 Project development tracker. Table `projects` + milestones + photos; staff create/update, admin and leader read. Reuse the work-items record pattern (`work_item_service`). Accept: history of changes.
- [ ] B7 Public feedback + constituency survey. Public form (web, no login) with rate limit + honeypot; results page for staff (web + phone). Accept: no personal data required; spam limit tested.
- [ ] B8 NEXT milestone, do not build now: voice assistant / IVR (needs telephony provider + budget).

## Needs from the owner (blocks only the marked tasks)
B1: SMTP for email (push works without). B2: the first 5 names. B3: platform API keys + which platforms. B5: AI key. B8: telephony provider.
