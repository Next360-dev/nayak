# Nayak UX architecture: one shell for all 36 modules (web + phone). Written 2026-11-24, status: PROPOSED (owner to approve)

Why: the current 5 tabs (Home / Live / Social / History / Portfolio) were built for news. Thirty-six modules cannot be added to them. We rebuild the SHELL (navigation, page templates, search, notifications) once, move the existing features into it, then every new module drops into a slot. No module gets its own bespoke navigation.

## 1. Principles
1. Organise by the user's JOB, not by feature name. Five areas cover everything.
2. Same five slots for every role (muscle memory); the content of a slot changes with the role.
3. Any module reachable in at most 2 taps/clicks. Never more than 5 bottom tabs.
4. Leaders look and decide (few, big, one-tap). Staff do the work (dense, fast, keyboard-friendly on web).
5. Every module uses the same page template (list, detail, create, history). Learn one, know all.
6. Permission-aware: a user never sees a module they cannot use. Modules switch on per office (feature flags), so a half-built module never shows.
7. Web and phone share the same area names, module names, icons, strings (`scripts/sync_i18n.mjs`), and API.

## 2. The five areas (same on web and phone)
| Slot | Leader sees | Staff sees | Modules |
|---|---|---|---|
| 1 Today | Briefing, top-5 alerts, what needs me, schedule | Work queue, my tasks, handover | 1 Dashboard, 24 Daily briefing, 35 Notifications |
| 2 Work | **Decisions**: approvals inbox, delegations | **Office**: everything the office runs | Leader: 28 Approval inbox, 30 Delegation, 22 AI drafting. Staff: 7 Visitors, 8 Letters & petitions, 9 Department tracker, 10 Appointments & tours, 15 Meetings & minutes, 16 Events, 29 Shift handover, 31 Meeting brief, 34 Tasks, 4 Activity reports, 20 Records |
| 3 Constituency | Overview, map, projects, grievances (read) | Full tools | 5 Grievances, 6 Projects, 11 Field staff app, 12 Schemes info, 14 Map & heatmap, 17 Feedback & surveys, 18 Funds, 19 Emergency alert, 32 Emergency contacts |
| 4 Media | News, social, alerts | + Watchlist, post studio, WhatsApp intake | 2 Competitor/watchlist alerts, 3 Legislative inbox, 26 News, 27 Social |
| 5 Me | Profile, portfolio, directory, settings | same + own account | 13 Directory, 33 Role views/profile, 36 Security, users, audit (admin) |
Assistant (floating button on every screen, not a tab): 21 Voice assistant, 23 Document summarizer, 25 Knowledge search.
All 36 modules appear exactly once above.

## 3. Navigation model
**Phone (bottom bar, 5 tabs):** Today | Work | Constituency | Media | Me. Each tab opens a HUB: search box on top, then module tiles with live counts (e.g. Letters 3, Visitors today 5, Overdue 2). A tile opens the module. A "+ New" button on Today and Work opens a quick-create sheet (letter, visitor, task, appointment, post). Bell (notification center) and Assistant live in the header/FAB on every screen. Admin: Today (control room) | Users | Activity | Me.
**Web (left sidebar, replaces the top tab strip):** the same five groups, expandable into their modules; collapsible to icons; the active module is highlighted. Top bar: global search (Ctrl+K command palette: modules AND records), "+ New", notification bell with unread, language, account. Leader identity bar appears only on Today, not on every page (saves vertical space). Staff workspace is a two-pane layout: list on the left, detail on the right (no modal chains).
**Deep links:** every module and record has a stable URL (`/work/letters/123`), so notifications and WhatsApp/email links open the right screen on both apps.

## 4. Page template (every module)
Header (title, count, "+ New") -> filter chips + search -> list (row = title, status badge, owner, due date) -> detail (phone: full screen; web: right pane) with tabs Overview / Activity (history) / Files -> create/edit form (same field components) -> empty, loading, error, offline states. Status colours only for status (ok / attention / danger). Every list supports "mine / all / overdue". Every record has an audit trail (who, what, when).

## 5. Cross-cutting systems (built once, used by all modules)
1. **Search:** one endpoint across modules the user may see; results grouped by module.
2. **Notification center:** one inbox for alerts, approvals, mentions; acknowledge, snooze, escalate after a time limit (module 35). Push + email use the same events.
3. **Quick create sheet** and **module registry**: a single list (id, area, icon, name key, roles, route, feature flag, badge query) drives the sidebar, the hubs, the command palette and permissions. Adding a module = adding one registry entry + its screens.
4. **Design tokens** (navy `#0B2545`, tricolor marks, saffron highlight for AI; type scale; 4-pt spacing) shared by both apps. Components: list row, status badge, KPI strip, filter chips, bottom sheet / side pane, form fields, confirm-by-two-taps.
5. **i18n** (English + Telugu, same keys), accessibility (contrast 4.5:1, 44 px targets, focus order), density setting for staff on web.

## 6. Build order (shell first, then modules)
- **S0 Shell + registry + design tokens:** new navigation on phone and web, hubs, search endpoint, notification center, quick-create. Existing features move into slots with NO new behaviour: Home -> Today; Live/History/Social -> Media; Portfolio + Profile -> Me; Letters, Team board -> Work; Projects, Survey -> Constituency; tools list on staff Home becomes the hubs.
- **S1 Finish partial modules:** 1, 28 (one inbox for letters + posts + suggestions), 35 (acknowledge/escalate), 13 (real contacts).
- **Wave 1 (Release 1 gaps):** 7, 10, 29, 30, 4, 31, 2 polish.
- **Wave 2 (Constituency):** 5, 9, 19, 32, 18, then 11, 14, 12.
- **Wave 3:** 15, 16, 3, 25. **Wave 4:** 22, 23, 20, 21 (real voice).
Each module ships on web AND phone before the next starts.

## 7. Acceptance for S0
- Max 5 tabs on the phone; every existing screen reachable in <= 2 taps; no screen without a back path.
- Sidebar, hubs and command palette are generated from the registry (a test fails if a module is missing from any of them).
- A user without permission never sees the module (tested per role: admin, leader, staff).
- Deep links open the right screen after login on both apps.
- Contrast, tap-target and Telugu-text checks pass; Playwright smoke test opens every route for every role with zero console errors.

## 8. Decisions needed from the owner
1. Approve the five areas and their names (Today / Work / Constituency / Media / Me).
2. Web: left sidebar instead of the top tabs?
3. Should staff and leaders share slot 2's name "Work", or use "Decisions" (leader) / "Office" (staff)?
4. Which wave first after S0: 1 (daily office) as planned, or 2 (grievances) if a client asks for it?
