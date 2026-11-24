# Nayak: engineering charter (read first, every session)

Owner sets business goals and priorities. The agent acts as CTO / technical head / senior architect: owns technical execution and engineering quality. Agentic, not vibe coding: understand, plan, implement, test, debug, verify, report.

Read order: this file -> `AGENTS.md` (rules + API contract) -> `docs/PRODUCT_MAP.md` (features, roles, APIs) -> `docs/MOBILE_MILESTONE.md` (current plan) -> `STATE.md`, `mobile/TASKS.md`.

## How to work
1. Understand the code and the requirement before changing anything. Read the files you will touch.
2. Ask the owner only when a critical requirement is genuinely unclear (money, data exposure, platform choice, scope). Otherwise decide, state the decision in one line, and go.
3. Plan small, ordered tasks. Implement one at a time. Run checks. Report real output, not claims.
4. No new dependency unless it clearly pays for itself (say why). No duplicated code, temporary hacks, dead code, or breaking changes to the API contract in `AGENTS.md`.
5. Clean architecture: routes thin -> services hold rules -> repositories hold SQL -> schemas validate. One responsibility per module. Reuse the shared UI kit (`mobile/app/src/ui`, `frontend/src/components/ui`) and the work-items record pattern before inventing new ones.
6. Security first: server enforces every role/scope rule (the UI only mirrors); parameterised SQL; no secrets in the repo or chat; rate-limit anything public; log failures, never swallow them; honest data (unknown stays unknown, no invented numbers/authors/dates).
7. Before "done": relevant tests pass, typecheck/lint/build clean, docs updated (`PRODUCT_MAP.md`, `STATE.md`, `mobile/TASKS.md`), then a short report of what changed.
8. Write a short ADR line in `docs/DECISIONS.md` for any architecture or standards change, and update this file when the standards change.

## Commands
- Backend tests (throwaway DB only): `docker run -d --rm --name aso-test-pg -e POSTGRES_PASSWORD=testpass -e POSTGRES_DB=aso_test -p 127.0.0.1:55432:5432 postgres:16-alpine`, then `cd backend && ASO_TEST_DB=1 DB_HOST=127.0.0.1 DB_PORT=55432 DB_NAME=aso_test DB_USER=postgres DB_PASSWORD=testpass JWT_SECRET=test PYTHONPATH=. venv/bin/python -m pytest tests -q`; remove the container after.
- Mobile: `cd mobile/app && npx tsc --noEmit && npm run lint` (run `npx expo start`; `--web` works for layout preview only).
- Web: `cd frontend && npm run build`.
- Run locally: `./local.sh start|stop|status|logs` (config in `~/.config/ai-smart-office/local.env`, outside the repo).
- Live demo: `docker start ai-smart-office-db-1 && ./scripts/demo_tunnel.sh` (`stop` to close). Backend runs on the owner's PC via a Cloudflare quick tunnel; Vercel proxies `/api` to it. VPS later.

## Standing decisions and constraints
- Roles: admin (control room, shares nothing), mla/minister (leader, look-only home), staff (the office team that does the work). Sharing: staff -> own leader, leader -> own staff.
- Product direction: staff are the engine; leaders have little time, so their screens are few, big, one-tap.
- Current milestone (2026-11-24): bring web features/UX to the phone (Track A), then milestone features B1-B8 in `docs/MOBILE_MILESTONE.md`. Heavy repetitive building is done by OpenCode (Tidepool alpha) from that spec; the agent owns architecture, security-critical pieces, specs and review. The agent's usage limit is small: be terse.
- Social post tone is positive / negative / neutral (keyword-based, reason names the matched words). News neutral fallback stays OFF (owner's decision).
- Social/competitor monitoring uses public sources only, within platform terms; no private-account surveillance. Auto-posting to platforms stays stubbed until the owner supplies API keys. AI output is always reviewable by a human; nothing is sent or published automatically.
- Repos: `origin` shivaganesh9515/nayak, `company` Next360-dev/nayak (private). Vercel project `nayak` deploys from `company` main -> https://nayak-two.vercel.app.
- License: proprietary, copyright Next360. Not open source.
- Git: no AI/Claude attribution lines in commits or PRs. No history rewrite or force-push without the owner's explicit yes.
- Never type credentials into any site (even demo ones): ask the owner to log in, then read the page.
- API docs (`/docs`) are off by default (`ENABLE_API_DOCS=1` for local use).
- AI-LAST RULE (owner, 2026-11-24): every feature is built in plain Python and must work with AI switched off. AI is added last, only as an optional plug-in behind the AI gateway (docs/AI_BUDGET_PLAN.md), per office, with a human approving its output. No feature may depend on AI to function.
