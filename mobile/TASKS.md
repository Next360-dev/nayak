# Mobile work breakdown (tick `[x]` when done and checked)

Order matters. Stop after each phase and report. See `AGENTS.md` for rules and the API contract.

## M0. Backend readiness (20%)
- [x] M0.1 Config: make `JWT_EXPIRE_MINUTES` and a new `MOBILE_REFRESH_DAYS` (default 30) settings; document in `.env.example`.
  Check: app imports; defaults unchanged for web.
- [x] M0.2 Refresh tokens: `POST /api/token/refresh`. Login returns `refresh_token` only when request sends `client: "mobile"`. Store a hash in new table `refresh_tokens` (migration `003_mobile.sql`), rotate on every use, revoke on logout (`POST /api/logout`), reject reuse.
  Check: tests for rotate, reuse rejected, revoked after logout, web login unchanged.
- [x] M0.3 Device tokens: table `device_tokens(username, token UNIQUE, platform, updated_at)`; `POST /api/devices` (register), `DELETE /api/devices` (unregister). Validate Expo token format `ExponentPushToken[...]`, max 5 per user.
  Check: tests for register, duplicate, other user cannot delete my token.
- [x] M0.4 Push sender: `app/services/push_service.py` sends via Expo Push API (`https://exp.host/--/api/v2/push/send`) in a background task after `create_share`; title = sender, body = share title, `data={share_id}`; urgent uses high priority. Failure must never fail the share. Remove tokens Expo reports as `DeviceNotRegistered`.
  Check: tests with the HTTP call mocked: sent for each recipient, none sent to the sender, share still succeeds when push fails.
- [x] M0.5 Rate limit on `/api/devices` and refresh. Update README/NOTES.
  Check: `pytest backend/tests` all green on the throwaway DB.
- [x] M0.6 Deployment doc `docs/DEPLOY.md`: HTTPS backend + Postgres, env vars, migrations 001-003. Do NOT deploy.

## M1. App scaffold + login (10%)
- [x] M1.1 `mobile/app`: Expo + TypeScript + Expo Router; ESLint/TypeScript strict; `API_BASE_URL` from `app.config` extra (env), never hard-coded.
- [x] M1.2 API client: Bearer header, JSON errors, on 401 try refresh once, else sign out. Tokens in `expo-secure-store` only.
- [x] M1.3 Login screen: username/password, error and lockout (429) messages, loading state, no password saved.
- [x] M1.4 Session: on launch call `/api/me`; route guard; logout calls `/api/logout` and unregisters the device token.
  Check: typecheck + lint clean; unit tests for the client (401 refresh, logout); runs on simulator/Expo Go and logs in against the throwaway-DB backend with demo users.

## M2. Inbox (25%)
- [x] M2.1 Inbox list: urgent first, unread dot, relative time, pull to refresh, empty and error states.
- [x] M2.2 Tab badge from `/api/shares/unread-count` (refresh on focus and every 60 s).
- [x] M2.3 Detail screen: note, summary, "Open source" link, auto mark `seen` on open.
- [x] M2.4 Status buttons: seen -> acting -> done with optimistic update and rollback on error.
- [x] M2.5 Reply thread: list + composer (max 2000 chars), staff replies show their own username.
  Check: component tests; manual run with demo users: admin shares on web, MLA sees it on mobile, changes status, replies, admin sees both on web.

## M3. News feed (15%)
- [x] M3.1 Feed list from `/api/news` for the signed-in user's scope; tabs All / Positive / Negative; 20 per page with infinite scroll; pull to refresh.
- [x] M3.2 Card: headline, summary, source, constituency, time, priority colour + label (not colour alone).
- [x] M3.3 English/Telugu toggle per card via `/api/translate`; remember language choice. Telugu text must render without clipping.
- [x] M3.4 Offline: show last loaded page with an "offline" banner.
  Check: tests for paging and scope; works with 0 articles and with API errors.

## M4. Push notifications (15%) (needs the user's Expo + Firebase accounts)
- [x] M4.1 Ask permission at a sensible moment (after login, with a short reason), register token via `POST /api/devices`, re-register on token change, unregister on logout. Settings switch to turn notifications off.
- [x] M4.2 Handle taps: foreground banner, background and cold-start open the right share detail.
- [x] M4.3 Android channel: `urgent` (high importance) and `default`.
  Check: on a real device, admin shares as urgent and the phone shows the notification; tapping opens the detail; logout stops notifications.

## M5. Admin features (10%)
- [x] M5.1 Share from a news card: recipient picker (search, All MLAs, by district), note, urgent switch; non-admin can only send to admin.
- [x] M5.2 Sent list with per-recipient status chips and per-recipient reply threads.
  Check: tests for recipient rules; manual round trip with an MLA account.

## M6. Quality + release prep (5%)
- [x] M6.1 Accessibility: labels on all controls, 44 pt touch targets, dynamic text size, contrast, screen reader order, reduce-motion respected.
- [x] M6.2 Error/empty/loading states on every screen; no crashes on expired token or no network.
- [x] M6.3 App name/icon/splash placeholders; `eas.json` profiles (development, preview, production) with no secrets.
- [x] M6.4 Update `STATE.md`, `NOTES.md`, add `mobile/README.md` (run, test, build).
- [ ] M6.5 (needs the user's yes) EAS preview build. Store publishing is out of scope until the user says so.

## Also still open on the web side (user must do, not an agent task)
- Apply migrations 001, 002 (and 003 after M0) to the real DB, set `JWT_SECRET`, run `backend/scripts/purge_fabricated_social_posts.py` dry run then `--apply`.
