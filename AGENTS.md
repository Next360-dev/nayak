# Project context for any coding agent (read this first)

**Read `docs/PRODUCT_MAP.md` first: every feature per dashboard level, permission matrix, API list, open audit items.**
**To understand or explain how the whole project is built (stack, every file, flows): `docs/PROJECT_GUIDE.md`.**

Nayak: governance news + admin/leader sharing for Telangana. FastAPI + PostgreSQL backend (`backend/`), React/Vite web app (`frontend/`), planned Expo mobile app (`mobile/`). Read `STATE.md` (status), `NOTES.md` (history), `mobile/PLAN.md` and `mobile/TASKS.md` (the work).

## Rules
- Work one task at a time, in the order in `mobile/TASKS.md`. After each task: run its checks, tick it in `mobile/TASKS.md`, update the % in `STATE.md`, then stop and report.
- Never touch a real database. Tests use a throwaway Postgres (see header of `backend/tests/test_shares.py`). Never put passwords, tokens, API keys or `.env` files in the repo or in chat.
- Do not deploy, publish to a store, create paid accounts or spend money. Stop and ask.
- Do not invent data (no seeded posts, no random numbers). Unknown stays unknown (NULL / "not available").
- Keep the web app working: run `cd frontend && npm run build` and `pytest backend/tests` (with the throwaway DB) before saying done.
- Auth is a Bearer token only. The server ignores `X-User-*` headers. Roles: admin, mla, minister, staff. Sharing: staff -> their own leader, leader -> their own staff; the master admin shares nothing and only watches (read-only). Everyone has their own inbox. Team board (tasks, notes, edited briefing): only inside one team = one MLA/minister + their own staff; staff manage tasks, the leader only reads and writes notes (docs/PRODUCT_MAP.md, 'Team-first features').
- Short commit-style summaries. Report real command output, not claims.

## API contract the mobile app uses (all need `Authorization: Bearer <token>` except login)
| Call | Result |
|---|---|
| `POST /api/login` {username,password} | `{status, token, user}` or `{status:"error"}`; 429 after 5 failures |
| `GET /api/me` | `{user}` (role, scoped, constituency_name, politician_name) |
| `GET /api/news?period=today&news_scope=all|positive|negative|statewide|civic&page=1&limit=20&constituency=..` | `{articles, pagination, counts}`; scoped users are pinned to their constituency server-side |
| `POST /api/translate` {headline,summary} | `{data:{translated_headline,translated_summary}}` |
| `GET /api/shares/inbox` | `{shares:[{id,sender,title,url,summary,note,priority,status,created_at,reply_count}]}` |
| `GET /api/shares/unread-count` | `{count}` |
| `PATCH /api/shares/{id}/status` {status: seen|acting|done} | `{share_status}` |
| `GET /api/shares/{id}/replies[?recipient=u]` | `{replies}` |
| `POST /api/shares/{id}/replies` {body, recipient?} | `{reply}` (recipient required when admin/sender replies) |
| `GET /api/shares/targets` | `{targets}` (staff: their own MLA/minister; MLA/minister: their active staff; admin: empty) |
| `POST /api/shares` {title,url,summary,article_id,district_name,constituency_name,note,priority,recipients[]} | `{share_id,recipient_count}` (admin gets 403; all_mlas/district broadcast removed) |
| `GET /api/shares/sent` | `{shares:[{..., recipients:[{recipient,status}]}]}` |
| 401 anywhere | token expired: clear token, go to login |
