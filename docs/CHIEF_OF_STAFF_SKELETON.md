# Chief of Staff: skeleton spec (Letters & Petitions with approval), STRICT

Who does what:
- **opencode** builds the BACKEND (tasks W0-W5). **freebuff** builds the MOBILE SKELETON (tasks W6-W7). They can work in parallel: the API contract below is fixed.
- **Claude (the user's main assistant) does ALL visual design, UI/UX polish and final review AFTER both finish.** So the skeleton must be PLAIN and FUNCTIONAL, never "designed".
- This is the first slice of the 36-module product spec. It is deliberately small: ONE workflow, end to end.

Project rules still apply (read `AGENTS.md`, `docs/PRODUCT_MAP.md`): never touch a real database in tests (throwaway Postgres only), no secrets in the repo or chat, no deploy/publish/spend, never invent data, auth is a Bearer token only, roles: admin, mla, minister, staff.

## 1. The workflow (nothing else is in scope)
A **letter or petition** (incoming or outgoing) is created by staff (the "PA/office team") or by the leader, goes to the leader for a decision, and keeps a full history.
Status machine (the DATABASE must enforce it, not only the API):
`draft -> submitted -> approved | rejected | changes_requested`; `changes_requested -> submitted` (after edits); `approved -> closed`; `rejected -> closed`.
- Create / edit (only in `draft` or `changes_requested`): any member of the team (the leader or the leader's own staff).
- Submit: the creator or any team member.
- Decide (approve / reject / request changes): ONLY the leader (role `mla` or `minister`) of that team. A staff member can never decide, an admin can never decide.
- Close: any team member, only from `approved` or `rejected`.
- The master admin has NO access to item content in this slice (internal correspondence is sensitive). Ask the user before changing that.
- Another leader's team: HTTP 404, never 403 (do not reveal existence).
Reuse the existing team concept exactly: a team = one leader + the staff whose `users.mla_username` is that leader (`in_team()` SQL function from migration 007).

## 2. Data model (migration `backend/migrations/010_work_items.sql`, safe to run twice, same style as 007)
`work_items`: `id BIGSERIAL PK`, `team_leader TEXT NOT NULL`, `kind TEXT NOT NULL CHECK (kind IN ('letter','petition'))`, `direction TEXT NOT NULL CHECK (direction IN ('incoming','outgoing'))`, `title TEXT NOT NULL (<=200)`, `body TEXT`, `reference_no TEXT`, `counterpart TEXT` (person/department it is from or to), `priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','urgent'))`, `due_date DATE`, `status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','changes_requested','approved','rejected','closed'))`, `created_by TEXT NOT NULL`, `assignee TEXT`, `decided_by TEXT`, `decided_at TIMESTAMPTZ`, `decision_note TEXT`, `created_at`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. Index `(team_leader, status)`.
`work_item_events` (append-only history): `id BIGSERIAL PK`, `item_id BIGINT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE`, `actor TEXT NOT NULL`, `action TEXT NOT NULL CHECK (action IN ('created','edited','submitted','approved','rejected','changes_requested','commented','assigned','closed'))`, `note TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. A trigger must RAISE on UPDATE and DELETE of events (append-only).
DB triggers (pattern of 004/007): creator, assignee and event actors must be `in_team(team_leader, who)`; a status change must be a legal transition (above); `decided_by` must be the team leader and is set only on approve/reject/changes_requested; `updated_at := NOW()`.
NOT in this slice: attachments/OCR (task W8, needs the user's yes), tasks migration, grievances, anything from the other 34 modules.

## 3. API contract (fixed; both sides code to this). All need `Authorization: Bearer`.
| Call | Body / query | Result |
|---|---|---|
| `POST /api/work-items` | `{kind, direction, title, body?, reference_no?, counterpart?, priority?, due_date?, assignee?}` | `{item}` status `draft`; event `created` |
| `GET /api/work-items` | `?status=&kind=&mine=1&limit=50&offset=0` | `{items:[Item], total}`; newest first; `mine=1` = created_by or assignee is me |
| `GET /api/work-items/{id}` | - | `{item, events:[Event], can:{edit,submit,decide,close,comment}}` |
| `PATCH /api/work-items/{id}` | any editable field | `{item}` only in draft/changes_requested; event `edited` |
| `POST /api/work-items/{id}/submit` | `{note?}` | `{item}` -> `submitted`; notifies the leader |
| `POST /api/work-items/{id}/decide` | `{decision:'approve'\|'reject'\|'changes', note?}` (`note` REQUIRED for reject and changes) | `{item}`; notifies the creator |
| `POST /api/work-items/{id}/comments` | `{body}` (1-2000) | `{event}` |
| `POST /api/work-items/{id}/close` | `{note?}` | `{item}` |
| `GET /api/work-items/pending-count` | - | `{count}` = items in `submitted` for the leader's team (0 for staff) |
`Item` = all columns plus `creator_name`, `assignee_name`, `leader_name` (display names; fall back to username). Errors: 404 unknown/foreign, 409 illegal transition (message names the current status), 422 validation, 403 only for "you may see it but not do that" (e.g. staff trying to decide).
Every write calls `audit_repository.log(...)` with action `work_item_<action>` (no body text in the audit detail).

## 4. BACKEND TASKS (opencode). Layers like shares: `app/repositories/work_item_repository.py`, `app/services/work_item_service.py` (all rules live here), `app/api/routes/work_items.py` (thin), registered in `app/main.py`. SQL helper style: follow `board_repository.py`.
- **W0** Read `AGENTS.md`, `docs/PRODUCT_MAP.md`, migrations 004/007, `board_repository.py`, `share_service.py`, `app/api/routes/board.py`, one test file (`tests/test_team_board.py`). Print: files you will add/change, the exact table/trigger list, and confirm no name clashes. STOP for the user's OK only if something in this spec conflicts with the code.
- **W1** Migration 010 + make `scripts/apply_migrations.py` pick it up (check how it discovers files; change nothing else).
- **W2** Repository + service with every rule in section 1; no SQL in the routes.
- **W3** Routes + the contract above; audit logging.
- **W4** Notifications on submit/decide: reuse `push_service` and `notify_service` exactly as `share_service` does; a notification failure must NEVER fail the request.
- **W5** `dashboard_service`: add `approvals: {pending: n}` to the leader dashboard (mla/minister) only. Do not change any other key.
- Tests (`backend/tests/test_work_items.py`, throwaway DB per the header of `tests/test_shares.py`), at least: create/list/get; every legal transition; every illegal transition returns 409 AND the DB trigger refuses it when SQL is run directly; staff cannot decide (403); admin gets 404/403 on everything; another team gets 404; leader cannot edit while submitted; reject/changes need a note (422); events are append-only (UPDATE/DELETE raise); pending-count right for leader and 0 for staff; push failure does not fail submit. Whole suite must stay green (currently 158 tests).
- Checks to paste: `cd backend && ASO_TEST_DB=1 DB_HOST=127.0.0.1 DB_PORT=55432 DB_NAME=aso_test DB_USER=postgres DB_PASSWORD=testpass JWT_SECRET=test ./venv/bin/python -m pytest tests -q` (throwaway container per the test header) and `cd frontend && npm run build`. Do NOT run migration 010 on the user's real local database; the user applies it (`./local.sh start` applies migrations, after a backup).

## 5. MOBILE SKELETON TASKS (freebuff). Repo `mobile/app`. READ FIRST: `mobile/UI_SPEC_FOR_FREEBUFF.md` sections 1-3 and `mobile/UI_SPEC_V2_STRICT.md` section B (rules S1-S13 apply here too, incl. the adb/Metro protocol S10).
Hard limits for the skeleton: PLAIN and FUNCTIONAL. Use ONLY existing components from `src/ui` (`Card`, `Row`, `Badge`, `EmptyState`, `ErrorState`, `ScreenHeader`, `GroupedList`, `Toast`, `NewsParts` pieces) and tokens from `src/theme`. Do NOT make visual design decisions, do NOT add new styles/colors/radii/spacings, do NOT polish. If a layout is not obvious, use a vertical `Card` with `Row`s. Claude will design it afterwards.
- **W6** `src/api/workItems.ts` (one typed function per call in section 3) + types in `src/types/index.ts` (`WorkItem`, `WorkItemEvent`, `WorkItemCan`). No UI.
- **W7** Routes `app/work/index.tsx` (list: filter by status via simple text buttons, pull to refresh, tap opens detail), `app/work/[id].tsx` (detail: fields, history list, action buttons shown ONLY when `can.*` is true: Submit, Approve, Request changes, Reject (note required), Comment, Close), `app/work/new.tsx` (create/edit form: kind, direction, title, body, reference no., counterpart, priority, due date `YYYY-MM-DD`). Entry points: a row "Letters & petitions" in `app/(tabs)/settings.tsx` (More) for mla/minister/staff (hidden for admin) and, for leaders, a row on Home showing `approvals.pending` when > 0. Loading / empty / error states = the existing `EmptyState` / `ErrorState`. After any write invalidate the query keys `['work-items']` and `['dashboard']`.
- Checks to paste: `npx tsc --noEmit && npx eslint .` clean, grep E1-E5 from `UI_SPEC_V2_STRICT.md` section E (no literals outside the theme). Manual flow on the phone ONLY under rule S10: staff creates and submits, leader approves, history shows both.
- Do not touch `news.tsx`, `index.tsx` layout, or anything freebuff's other UI tasks own; only the entry-point rows named above.

## 6. After both finish (Claude, not you)
Claude audits the skeleton against this spec, then designs the real screens (layering, headers, sticky filters, status stepper, decision sheet, empty states, Telugu copy), adds attachments, and reviews security. Each of you ends your work by writing `docs/CHIEF_OF_STAFF_HANDOFF.md` (one file, append your section): what was built, file list, endpoints/screens, tests run with real output, known gaps. No claims without command output.

## 7. Order and stop rules
One task per message, in order, within each person's list. After each task: paste real command output, tick it in this file by changing `[ ]` to `[x]`, report in <= 8 lines, STOP. If anything is missing from this spec, STOP and ask; never guess a field, route or rule. No commits, pushes, deploys. Task checklist: `[x] W0 [x] W1 [x] W2 [x] W3 [x] W4 [x] W5 [x] W6 [x] W7`.
