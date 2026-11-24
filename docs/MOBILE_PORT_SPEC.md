# Track C: bring the new web UX to the phone app (for OpenCode). Written 2026-11-24.

Source of truth = the web app as of commit 76d20a0. Rules, checks and code map: same as `docs/MOBILE_MILESTONE.md` (read it and `CLAUDE.md` first). One task at a time; tick in `mobile/TASKS.md`.
Same backend, same API contract. New endpoints are in `backend/app/api/routes/features.py` and `portfolio.py` (read them; do not change them from the phone work).

## Web design language to match (read from the web code)
- Primary navy `#0B2545` (buttons, headings), soft accent `#E8EEF8`, white cards, slate borders (`#E2E8F0`), tabular numbers on KPIs.
- Indian tricolor strip/accents: saffron `#FF9933`, white, green `#138808`. Orange highlight is used for the AI/voice action.
- Section pattern: `Page title + subtitle`, then `Section(title, description, action)` blocks. KPI strip: label (11px caps), big number, hint.
- Rule: tokens only in `src/theme/index.ts` (replace the old ivory/gold palette; keep status colours ok/attention/danger).

## Navigation (match web `home/NavTabs.jsx`)
Bottom tabs: **Home | Live | Social | History | Portfolio**. Header identity bar on every tab: avatar with initials + online dot, name, constituency, and three buttons: Inbox (badge), Voice assistant, Account (opens More). Team board and Letters live inside Home (not tabs). Staff and leaders see different Home content (below).

## Tasks (in order)
- [ ] C0 Theme tokens + tricolor header strip + `LeaderIdentityBar` component. Accept: no hex outside theme; all existing screens still render.
- [ ] C1 i18n first (= A1 in MOBILE_MILESTONE): reuse the web's `tr()` key names (`frontend/src/i18n`), English + Telugu, so every screen below is bilingual from day one.
- [ ] C2 Navigation rework to the 5 tabs + identity bar. Live = today's news (+ alert banner, A2), Social = social feed (+ A7 filters), History = archive. Accept: deep links and push taps still open shares/letters.
- [ ] C3 Leader Home (mla/minister), same order as web `home/LeaderHome.jsx`: Actions (Compose, Projects, Voice assistant [orange], Briefing, Open feed) -> Picked for you (inbox with one-tap Seen/Act/Done) -> Needs attention -> Districts (minister only) -> My team.
- [ ] C4 Staff Home, same as `home/StaffHome.jsx`: KPI strip (stories today, waiting on leader, acting, done) + Staff tools list: News review, Projects, Post composer, Approvals, WhatsApp intake, People watchlist.
- [ ] C5 Port the staff tool screens (API in features.py): Top alerts (`/api/alerts/top5`), Watchlist (`/api/watchlist`), Post composer + status (`/api/composed-posts`), Projects (`/api/projects`), WhatsApp intake (`/api/whatsapp/*`), Leader suggestions with approve (`/api/leader/suggestions`), Survey results (`/api/public-survey/results`).
- [ ] C6 Portfolio tab: leader sees the published portfolio (profile, milestones, projects, public preview, directory); staff can edit and publish. API: `portfolio.py`.
- [ ] C7 Voice assistant popover: same behaviour as web `home/LeaderVoiceAssistant.jsx`; if it needs a paid service, show the same state the web shows. Do not add new vendors.
- [ ] C8 QA: 360 px, font scale 1.3, Telugu text, offline/empty/401 states, dark text contrast >= 4.5:1; update `docs/PRODUCT_MAP.md` (mobile parity).

## Not in this track
Voice/IVR calls, real posting to platforms (stubbed until API keys), survey per-leader link (backend task, see `docs/REVIEW_2026-11-24.md` P0: do that before exposing survey results on the phone).
