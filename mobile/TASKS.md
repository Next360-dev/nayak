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

---

# PHASE 2: web parity + single login (added 2026-11-18, user asked to resume mobile)

Rule of this phase: ONE login. The phone uses the same `POST /api/login`, the same `users` table, the same roles and the same server-side scoping as the web app. No mobile-only accounts, no second password. The server decides what each role sees; the app only draws it. Source of truth for features and endpoints: `docs/PRODUCT_MAP.md` (read it first, it is newer than M0-M6).
Where work: backend/web changes in this repo; app changes in `mobile/app` (its own git repo). Do one task, run its check, tick it, stop and report. Never commit secrets. Do not build or publish without the user's yes.

## M7. Single-login hardening + contract parity (do FIRST, shared by web and phone)
- [x] M7.1 Backend: `must_change_password` column (new migration 009, default FALSE). `create_team.py` and admin create/reset set it TRUE. `/api/me` returns it. Login stays the same call.
  Check: tests: flag set on create/reset, cleared by `POST /api/me/password`, web login unchanged.
- [x] M7.2 Backend: `MIN_PASSWORD_LENGTH` 12 for self-chosen passwords; reject top-common passwords and a password equal to the username. Generated passwords are unaffected.
  Check: tests for each rejection; existing 150+ tests still green.
- [x] M7.3 Backend: per-IP limit on `POST /api/login` (e.g. 20 tries / 15 min across ALL usernames) in addition to the per-user lockout; 429 message unchanged.
  Check: test that one IP spraying 21 different usernames gets 429; a second IP is not affected.
- [x] M7.4 Web: when `must_change_password` is true, force the change-password dialog before anything else.
  Check: browser check with a throwaway user.
- [x] M7.5 Phone types: update `src/types/index.ts` User with `leader_title`, `leader_party`, `can_share`, `scoped`, `must_change_password`; header/role labels use `leader_title` (MP/MLA/Minister), not a hard-coded "MLA".
  Check: tsc + lint clean.

## M8. Phone login, session, change password
- [x] M8.1 Login screen: show lockout (429) and invalid messages like web; after login, if `must_change_password` go to a Change password screen that cannot be skipped.
- [x] M8.2 Change password screen (also reachable from Settings): `POST /api/me/password`, show the new 12-character rule, store the fresh token it returns, sign out other sessions.
- [x] M8.3 `API_BASE_URL` per build profile (development = local/tunnel, preview/production = real HTTPS host). Document how to point at the demo tunnel in `mobile/README.md`. Tunnel address changes: never hard-code it.
  Check: manual login on a device/emulator with the same aadi_srinivas credentials used on the web; token expiry and 401 sign-out still work.

## M9. Role homes (same as web Home)
- [x] M9.1 Home tab using `GET /api/dashboard`: Control Room (admin, read-only), My Constituency (MLA/MP), State Overview (minister), Work Queue (staff). Pull to refresh, skeletons, error + retry.
- [x] M9.2 Tab bar per role: admin = Home, Shares (read-only), Users; leader = Home, News, Inbox, Team; staff = Home, News, Inbox, Team board. Admin sees no share/create buttons.
  Check: log in as each of the 4 demo roles, tabs and buttons match PRODUCT_MAP permission matrix.

## M10. News parity
- [x] M10.1 Scope tabs: All, Positive, Negative, Statewide, Civic, Social, with server counts. Social posts are mixed into All/Positive/Negative sorted by time with articles; Statewide and Civic are articles only. Fetch social stats ONCE per constituency (not per tab) so badge numbers never jump (same fix as web commit d8c024d).
  Check: switch All -> Positive -> Negative -> All, counts identical each time.
- [x] M10.2 Latest (rolling last 24 h) vs Archive (older, presets 24-48 h, 3, 7, 14 days), same server params as web.
- [x] M10.3 Refresh news button: `POST /api/news/refresh`, poll `GET /api/news/refresh/status`, show the cooldown, never double-fire.
- [x] M10.4 Area leaders (MP of a Lok Sabha seat): nothing special on the phone, but each story shows its own segment name; verify with `aadi_srinivas` (single constituency) and an MP seat.
  Check: tests for the news hooks (paging, scope, empty, error); works offline with the cached page.

## M11. Team features (staff + leader)
- [x] M11.1 Team board: staff create/move/complete tasks; leader read-only; team notes (leader may write); editable morning briefing (staff). Use the board endpoints listed in `docs/PRODUCT_MAP.md` "Team-first features".
- [x] M11.2 My team (leader): add, reset password, disable/enable their OWN staff only. Reset sets `must_change_password`.
  Check: another leader's staff return 404 on the phone too; staff cannot see the screen.

## M12. Admin lite
- [x] M12.1 Users list with last login, reset password, disable/enable (no create on phone unless the user asks). Shares list read-only.
  Check: admin cannot disable an admin; every action shows in the audit log.

## M13. Release (needs the user's yes for each)
- [ ] M13.1 Real device test of all 4 roles on Android: login, push, share round trip, news, team board. Fix what breaks.
- [x] M13.2 Accessibility + Telugu text clipping pass on the new screens.
- [x] M13.3 Update `STATE.md` (remove "mobile PAUSED"), `docs/PRODUCT_MAP.md` audit list, `mobile/README.md`.
- [ ] M13.4 (user yes) EAS preview build. Store publishing stays out of scope.

## Execution order (strict)
M7.1 -> M7.2 -> M7.3 -> M7.4 -> M7.5 -> M8.1 -> M8.2 -> M8.3 -> M9.1 -> M9.2 -> M10.1 -> M10.2 -> M10.3 -> M10.4 -> M11.1 -> M11.2 -> M12.1 -> M13.1 -> M13.2 -> M13.3 -> M13.4.
Why this order: M7 changes the server contract that both clients depend on, so it goes first; M8 is the single login on the phone; M9-M10 give every role the same home + news as web; M11-M12 are the role-specific extras; M13 is verification and release.

---

# PHASE 3: mobile UI/UX upgrade (planned 2026-11-18, from real phone screenshots)

Findings on the phone (Expo Go, Android, MLA login): (1) a red error toast "Uncaught (in promise) Error: Call to function 'Expo..." covers the tab bar; (2) tab icons render as empty box glyphs; (3) look is stock Material: default blue #1976d2 (36 uses) instead of the web brand (ink blue #0B2545 / #17408B), no logo, 8 different corner radii, no dark mode, no icon set, no haptics, no motion, system font; (4) six tabs for a leader (Home, News, Inbox, Sent, Team, Settings) is crowded; (5) Home repeats "Home" + "My Constituency" and shows walls of zeros. Good already: Telugu text renders cleanly.
Rules (appllama design skill): one accent colour, one grey family, one radius scale (pill buttons, cards 16, inputs 12), 8-pt spacing, semantic light+dark colours, native-feeling controls, real icons (no emoji), full state cycles (skeleton, empty, error), motion only where it has a purpose and respects Reduce Motion. Install packages only with `npx expo install`. Docs: https://docs.expo.dev/versions/v58.0.0/ (Expo changes each SDK, do not trust memory).

## U0. Fix what is broken (first)
- [x] U0.1 Find and fix the uncaught "Call to function 'Expo..." promise error (likely expo-notifications / push registration in Expo Go): guard it, never show a red toast to the user.
- [ ] U0.2 Tab bar icons: use `@expo/vector-icons` (MaterialIcons) so no glyph renders as a box.
  Check: phone shows no red toast; every tab has a real icon.

## U1. Design tokens + theme
- [ ] U1.1 `src/theme/`: colours from web tokens (`frontend/src/shadcn.css`: primary #0B2545, brand #17408B, attention amber only for "needs attention"), light + dark via `useColorScheme`, one grey family, radii scale, spacing scale, shadow rule.
- [ ] U1.2 Fonts: Public Sans (Latin) + Noto Sans Telugu via `expo-font`; type ramp (title, headline, body, caption); tabular numerals for counts. Telugu must not clip at 1.3x font scale.
- [ ] U1.3 Replace every hard-coded colour/radius with tokens.
  Check: `grep -rE "#[0-9a-f]{6}" app src` finds only the theme file; both themes screenshot-checked.

## U2. Shared components (build once, reuse)
- [ ] U2.1 `Screen`, `Card`, `StatStrip`, `StoryRow` (headline first, quiet meta line, tone badge), `Chip`, `Button` (pill, press scale 0.97), `Field`, `Badge`.
- [ ] U2.2 `Skeleton` (same shape as the final layout), `EmptyState` (says how to fill it), `ErrorState` (specific message + Retry), `OfflineBanner`.
  Check: each used on at least one screen; 44 pt tap targets.

## U3. Navigation and chrome
- [ ] U3.1 Fewer tabs: leader = Home, News, Inbox (Received | Sent control), Team; staff = Home, News, Inbox, Board; admin = Home, Shares, Users. Settings/Account opens from a header avatar menu, not a tab.
- [ ] U3.2 Real header: Nayak logo + role title ("MLA Office" / "MP Office" / "Minister Office"), native stack titles, unread badge on Inbox, English/Telugu interface switch (parity with the web, remembered).
- [ ] U3.3 Presentation: share composer and change password as modal; filters as a bottom sheet; status changes via native action sheet.
  Check: Android back and tab re-tap behave; sign-in cannot be returned to after login.

## U4. Screens
- [ ] U4.1 Home per role: one stat strip (amber only when something needs attention), top stories as StoryRows, hide zero-only sections, pull to refresh, no repeated titles.
- [ ] U4.2 News: scrollable scope chips with stable counts (All, Positive, Negative, Statewide, Civic, Social), Latest | Archive, FlashList, social posts as cards, Refresh button with cooldown, per-card English/Telugu.
- [ ] U4.3 Inbox + share detail: urgent first, status stepper (seen, acting, done), reply thread, optimistic updates with rollback.
- [ ] U4.4 Team board: To do | Doing | Done segmented view, add task sheet, swipe to complete (staff), read-only for leaders, notes and briefing in their own sections.
- [ ] U4.5 Account: change password, language, notifications switch, sign out; first-login forced change keeps the same look.
  Check: screenshot of every screen for MLA, MP, staff, admin in light and dark.

## U5. Motion, haptics, performance
- [ ] U5.1 Press feedback (scale 0.97 on buttons/cards, highlight on list rows), 150 ms ease-out; list rows never animate on entry.
- [ ] U5.2 Light haptic on status change and task complete only (`expo-haptics`); Reduce Motion respected.
- [ ] U5.3 Lists: FlashList, `expo-image` for any image, stable keys.
  Check: scrolling stays smooth on the phone; no dropped-frame stutter when switching tabs.

## U6. QA and sign-off
- [ ] U6.1 Test at font scale 1.3, 360 px wide phone, light + dark, Telugu + English, offline, empty account, expired session.
- [ ] U6.2 Accessibility: labels on all controls, contrast AA in both themes, screen reader order.
- [ ] U6.3 Update `mobile/README.md` and `STATE.md`; commit in the mobile repo.
  Check: tsc + eslint clean; user approves screenshots before any build.

Execution order: U0.1 -> U0.2 -> U1.1 -> U1.2 -> U1.3 -> U2.1 -> U2.2 -> U3.1 -> U3.2 -> U3.3 -> U4.1 -> U4.2 -> U4.3 -> U4.4 -> U4.5 -> U5.1 -> U5.2 -> U5.3 -> U6.1 -> U6.2 -> U6.3. One task per handover; stop and report after each.

---

# PHASE 3 (UI spec): mobile UI/UX rollout (F-series, from mobile/UI_SPEC_FOR_FREEBUFF.md)

## F. Shared components + screens (UI spec order)
- [x] F0 Tokens cleanup. Move every hex still outside `src/theme` into named tokens `tints = { gold, violet, blue, green }`, `flag = { saffron, green }`; update `HomeParts.tsx` and `app/(tabs)/index.tsx`. Accept: tsc + eslint clean; grep clean on touched files.
- [ ] F1 Shared components (section 4 of spec): ScreenHeader, Button, TextField, SegmentedControl, FilterChips, BottomSheet.
- [ ] F2 Login + More (app/(auth)/login.tsx, app/(tabs)/settings.tsx).
- [ ] F3 News (app/(tabs)/news.tsx; install @shopify/flash-list).
- [ ] F4 Inbox + Sent + Share detail (inbox.tsx, sent.tsx, share/[id].tsx).
- [ ] F5 Share create (share/create.tsx) as modal.
- [ ] F6 Team board (team.tsx).
- [ ] F7 My team (my-team.tsx).
- [ ] F8 Users admin (users.tsx).
- [ ] F9 Change password (change-password.tsx).
- [ ] F10 QA pass (font scale 1.3, 360 px, Telugu, offline, empty, expired session).
- [ ] F11 Housekeeping (dead code, uninstall expo-linear-gradient if unused, README, tick U-tasks, STATE.md line, code-review pass).

## V. UI v2 strict (mobile/UI_SPEC_V2_STRICT.md; supersedes F-series layout)
- [x] V0 Layering + tokens. src/theme/index.ts (surface/line/hairline/shadowCard/shadowBar/veil/banner; opaque card), src/ui/index.tsx (Card shadowCard), src/ui/FloatingTabBar.tsx (solid ivory wrapper, shadowBar, no seam), src/ui/HomeParts.tsx (HeaderButton bg surface), src/ui/NewsParts.tsx (Segmented/DateChip/refresh/scope -> surface/banner tokens), app/_layout.tsx (veil on Backdrop); #fff -> surface in sent/team/users/my-team for E1. Accept: E1 clean, tsc+eslint clean, no picture behind cards on Home/News, no seam above tab bar.
- [x] V1 Shared building blocks. New src/ui/ScreenHeader.tsx (L2 header band surface, title 24/700, 40x40 action circles, badge), StickyBar.tsx (solid ivory wrapper + bottom hairline for sticky ListHeader), GroupedList.tsx (one white L1 card per section, 32x32 radius.chip icon square, value right-aligned muted 15, chevron 20 when pressable, hairline dividers inset 60dp, section title 13/600 muted), Toast.tsx (bottom inline pill, auto-hide 2.5s, accessibilityLiveRegion polite), BottomSheet.tsx (modal sheet top radius 28, scrim), Button.tsx, TextField.tsx, FilterChips.tsx. Exported from src/ui. Accept: each used by a screen in V2-V5; no hex/rgba literals; tap targets >=44; tsc+eslint clean.
- [x] V2 News (compact). app/(tabs)/news.tsx rewritten: fixed ScreenHeader title News + subtitle place·Updated relative, actions search/refresh, search field with 400ms debounce + search param; sticky StickyBar ScopeTabs (6 scopes capped 999+) + Segmented Latest|Archive + PresetChips; StoryCard with onLongPress bottom-sheet report (POST /api/feedback/story); picture only when image_url; tsc+eslint clean. Added search + reportStory to src/api/news.ts.
- [x] V3 More (settings hub). app/(tabs)/settings.tsx rewritten: ScreenHeader "More", profile card Monogram 64 + name (politician_name) + leader_title·leader_party + constituency; GroupedList sections ACCOUNT/NOTIFICATIONS/SECURITY/TEAM/HELP/ABOUT with real functions (PUT /api/me/profile all 4 fields, push switch existing logic, email alerts alerts_enabled, test alert POST /api/me/test-alert hidden if email_configured false, change password, logout action sheet, sent shares/my-team role-gated, feedback sheet POST /api/feedback/app, version/build/server health GET /api/health), single Sign out row c.danger. Added src/api/profile.ts. tsc+eslint clean.
- [x] V4 Inbox (+Sent). app/(tabs)/inbox.tsx (ScreenHeader, Segmented Received|Sent, FilterChips All/New/Acting/Done, grouped card rows with unread dot + badges, urgent-first, empty state with Share button, optimistic status), app/(tabs)/sent.tsx (thin redirect to inbox?sent=1), app/share/[id].tsx (ScreenHeader back, title/sender/summary/note/Open source, status Segmented optimistic+rollback+haptic, reply bubbles mine-right accentBg others-left white, composer pinned above keyboard with counter). Accept: empty state matches, opening share lowers tab badge, reply works, tsc+eslint clean.


# PHASE 4: UX audit + engagement rollout (2026-11-23; plan in mobile/UX_AUDIT_AND_PLAN.md and mobile/ENGAGEMENT_PLAN.md)
- [x] U0 Bugs. Inbox rows were drawn twice; the sort changed the cached list; no loading/error state; tab taps grew the back stack; Settings list could not scroll (it sat in a View); Team screen was a stub (Add task / filter did nothing, Save sent an EMPTY briefing); news cards did not open the story; share detail showed a blank screen for a share not in the inbox. B5 (story lost after restart) not a real case: stories open only from lists.
- [x] U1 Tokens and kit. One accent rule (gold for actions; `forest` -> neutral `ink`; quick actions single tone; status colours only for status), `lineHeight` on body/caption (Telugu), tab label 12 / badge 11, "Leaders" naming, TextField focus ring + theme colours, FilterChips/GroupedList use tokens.
- [x] U2 Home. Leader: "What's waiting" (waiting / urgent / negative) then "Picked for you" with one-tap Seen / I'll act / Done. Staff: "Work queue", "From your leader", "Stories to review". Story screen: Share is the main button (Send to my leader / team), Read full story second.
- [x] U3 Inbox: shared `ShareRow` with one-tap status, skeleton, retry, filter-empty state, next-step empty state, "all caught up" footer.
- [x] U4 Login + change password rebuilt on `AuthShell` (brand mark, theme tokens, show password, keyboard-aware); Share create rebuilt (theme, ScreenHeader, checkbox rows, disabled Send until valid).
- [x] U5 "New since you were last here" marker + count (News), "You are all caught up" footer, Saved stories (backend migration 011 + `/api/saved`, bookmark on Story, `app/saved.tsx`, Settings row, Home quick action), This week card (backend `week` counts).
- [x] U6 Admin Home trimmed (5 leaders, 5 activity rows).
- [x] Team board rebuilt (real tasks: add, move, assign, notes, status filter, briefing loads before it can be saved).
- [ ] Not done, needs your decision or account: real dark mode (surface/hairline are fixed light constants in ~15 files; a full token refactor), morning-briefing push (needs a scheduler on the server; push for new shares already exists), Expo/Firebase account for a real push test, F-series items for My team, Users, Work screens, on-device QA (360 px, font 1.3, Telugu), web pass at 375/768/1440.
- [x] Social crawling fix (2026-11-23): the scraper searched one exact quoted name, so lesser-known MLAs returned 0 posts (Achampet: 0 -> 36). Now several query variants (full name, then last two words + constituency), items must actually name the person, HTTP 429 is retried once and every failure is logged (it was swallowed). Mobile: the Social tab has a working Refresh (it ran the crawl; nothing on the phone could before), social posts show their text and open the original post. Tests: tests/test_social_queries.py. Still open: nothing crawls social automatically (only the Refresh button), and engagement counts stay "not available".
- [x] Home top section redone (2026-11-23): `StatusBrief` (one sentence for what needs you + three tiles that open Inbox / News filtered; a tile is coloured only when its number is above zero) and `ShortcutGrid` (2x2 cards with live info: Inbox new count, Team overdue/open, Saved count; primary tile gold). Inbox and News accept `filter` / `scope` params from the tiles. Replaced `SummaryCard` row and `QuickActions`.

# Track C (docs/MOBILE_PORT_SPEC.md): port the new web UX
- [x] C0a Theme: navy #0B2545 primary, #F8FAFC bg, slate borders, saffron/green flag marks, `highlight` orange token; dark palette updated (not enabled). `Hero` is now the identity bar (tricolor strip, avatar + online dot, name, place, Inbox button). tsc + lint clean. NOT checked visually (browser extension disconnected).
- [ ] C0b Rebuild `app/my-team.tsx` on the UI kit (still raw styles and old hex colours). Then C1 (i18n), C2 (5 tabs), C3 leader home, C4 staff home, C5 staff tools, C6 portfolio, C7 voice, C8 QA.
- [x] C1 i18n: `scripts/sync_i18n.mjs` generates `mobile/app/src/i18n/strings.generated.ts` from the web strings (run after editing `frontend/src/i18n/strings.js`); `useLang()`; language row in More. New screens use web keys. Existing older screens (Inbox, Team, Work, Share) are not yet fully translated.
- [x] C2 Navigation: bottom tabs Home / Live / Social / History / Portfolio (leader + staff); Inbox, Team, More reached from the identity bar and Home; admin keeps Home + Users.
- [x] C3 Leader Home: status brief, Picked for you, Leader actions grid (compose, projects, AI voice, AI inbox, briefing, feed, survey, saved), needs attention, Districts (minister), team board.
- [x] C4 Staff Home: status brief + Office tools list (live news, top alerts, projects, post composer, letters, WhatsApp, watchlist, survey, team board, saved).
- [x] C5 Office tools screens in `mobile/app/app/tools/`: alerts, watchlist, compose, projects, whatsapp, suggestions, survey, briefing, voice, directory, audit. API client `src/api/office.ts`.
- [x] C6 Portfolio tab (leader reads, staff edit + publish, public preview link).
- [x] C7 Voice assistant (text; answers only from loaded office numbers; dictation via keyboard mic).
- [x] A2 alert strip on Live, A3 urgent-only + district filters, A5 directory, A6 admin activity log, A7 social platform + tone filters. A4: sources list already on the Story screen.
- [x] C0b My team rebuilt on the UI kit. Background picture removed (file deleted, plain slate background everywhere). Titles of Home/Inbox/Team/More translated.
- [ ] Left: translate the remaining body text (Home brief sentences, Work, Share create, Story); C8 QA on a real device (360 px, font scale 1.3, Telugu). Not checked visually: the browser extension was disconnected.
- [x] Profile page (`app/profile.tsx`, opened from the avatar in the identity bar and from More): identity card, contact details (email, phone, email alerts), language, change password, two-tap Sign out (`ConfirmButton`, works in browsers where Alert does not). My team's Disable/Enable now uses the same two-tap confirm.
