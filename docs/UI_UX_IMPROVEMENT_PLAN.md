# Web app UI/UX improvement plan

**Review date:** 2026-11-24
**Scope:** `frontend/` web app, with existing role, sharing, and constituency rules preserved.
**Approach:** Improve the current product in small, reviewable steps. Keep the existing bilingual English/Telugu support and the calm Nayak visual language; do not replace real data with demo content.

## What the app already does well

- The product has clear user roles: admin, leader, and staff. The home screen changes based on role.
- The leader home emphasizes the inbox and one-tap share status actions. The staff home puts story review and sharing near the top.
- The news feed has meaningful filters, scopes, and history controls, and the app already has retry, loading, and empty states in several established flows.
- The newer home screens use a restrained palette, consistent shared components, and keyboard focus styling.
- English and Telugu are supported for the established app and many of the new feature labels.

## Findings to address

### P0 — Make every visible feature work

- `App.jsx` renders `ComposeScreen` and `ProjectTracker` with a `currentUser` prop, while both components read `user`. Opening either screen can fail when it reads `user.role`.
- The compose and project screens render outside the `.shadcn-scope` that supplies the CSS color tokens. Their UI components therefore lack the intended scoped theme values.
- **Resolved:** `SurveyPage.jsx` is routed at `/survey`, linked from sign-in, and its form now imports `CardDescription` and has associated field labels.
- The new features are mixed into role home screens, while compose and projects use separate top-level views. There is no shared section navigation or page heading/back path for those views.
- Some new screens turn request failures into an empty list, making a service failure look like “no items.” Surface a retryable error state instead.
- Most translation keys used by the milestone screens were absent from the English/Telugu catalog, so the UI would show raw keys such as `compose.title` and `watch.save`.
- The watchlist has add/remove/save controls, but needs a clear five-name limit in the interaction itself and feedback when changes have been saved.
- Project and post screens need consistent action feedback, loading/empty/error handling, and clear status meaning. Project status changes currently use an inline edit pattern that is hard to scan on narrow screens.

## Role design contract

- **Staff = office operations.** Staff monitor issues, manage the watchlist, route incoming WhatsApp updates, prepare post drafts, maintain project records, work the team board, and send decisions or stories up to their leader.
- **Leader = decisions and oversight.** Leaders act on shares, approve/reject staff drafts, review high-priority stories and suggestions, and oversee project/team progress. Leaders do not create post drafts, edit project records, manage the watchlist, or submit WhatsApp uploads.
- **Master admin = system control room.** The actual `admin` role stays separate and can inspect office records; it does not become the staff operations role.

### P1 — Clarify the daily workflow

- Staff home now carries alerts, watchlist management, WhatsApp intake, story review, tasks, sent shares, leader inbox, compose, projects, and briefing actions. This is a lot of competing entry points for one first screen.
- Leader home similarly adds top alerts and suggestions before the existing “Picked for you” and attention stories. Preserve the leader’s primary job: decide what to do with team-picked items.
- Separate daily work from setup/management. Keep urgent items and pending decisions prominent; place watchlist management, imports, and project administration in clearly named sections.
- Use explicit, product-specific navigation labels and provide a visible way back to Home/News from compose and project views.
- Make the status and next step clear on each item: who owns it, who needs to act, and what action is available to the current role.

### P1 — Make the visual system feel like one app

- The established feed uses a large legacy stylesheet while home and newer components use scoped Tailwind/shadcn styles. The result risks different spacing, controls, page widths, and typography between adjacent areas.
- Use one shared page frame, heading rhythm, button sizing, form labels, status colors, and responsive spacing. Keep the existing role-home layouts and migrate gradually rather than restyling every screen at once.
- Keep color semantic: red for urgent/error, amber for needs attention, blue for navigation/action, and green for complete. Avoid decorative motion on alerts; provide reduced-motion support for any retained animation.
- Ensure Telugu labels wrap without clipping, especially in headers, action rows, badges, tables, and mobile navigation.

### P2 — Improve the news and review experience

- Make the search/filter state easy to understand and clear, particularly on mobile where filters are in a drawer.
- Keep the active news scope, period, and constituency visible when the user scrolls through results.
- Improve article scanning: priority and sentiment should be readable without relying on color alone; actions should remain easy to reach at phone width.
- Provide a clear explanation when social or civic results are unavailable or empty, rather than falling back to unrelated articles.
- Keep the representative directory helpful but secondary to the story list, particularly on small screens.

### P2 — Accessibility and resilience

- Check keyboard order, visible focus, modal focus management, button names, form labels, and status announcements across all primary paths.
- Add `aria-live` announcements for save/approve/status changes where the page otherwise updates silently.
- Use consistent loading, empty, error, and success states. Preserve user-entered form data after a recoverable network error.
- Check table overflow, target sizes, contrast, and screen-reader names at mobile widths and in Telugu.
- Honor `prefers-reduced-motion` for the urgent ticker and other motion in the legacy feed styles.

## Recommended implementation sequence

### Phase 1 — Integration and trust

1. Fix `user`/`currentUser` prop contracts for compose and project screens.
2. Wrap all new screens in the shared themed page frame and add a consistent title, breadcrumb/back action, and responsive width.
3. Add an intentional public survey route independent of staff authentication, with accessible form labels and a sign-in entry link.
4. Replace silent list failures with retryable error states; add success feedback for save, approve, reject, and status updates.
5. Enforce the watchlist limit visibly and disable add/save actions appropriately.

### Phase 2 — Navigation and home priorities

1. Define a compact app navigation model for Home, News, Shares/Inbox, and work areas (Projects, Compose, Briefing, Team) that respects each role’s permissions.
2. Keep staff home focused on stories to review and shares waiting on the leader; move intake and configuration controls into a secondary “Tools” area.
3. Keep leader home focused on pending decisions and top constituency alerts; place suggestions as contextual actions, not a separate noisy feed.
4. Give admin a clear control-room hierarchy: operational risks first, then teams and system detail.

### Phase 3 — Shared design language

1. Create a shared page shell and shared form, list-row, empty-state, error-state, and status components.
2. Migrate one existing flow at a time, beginning with Compose and Projects, then the News feed and dialogs.
3. Consolidate spacing, type sizes, breakpoints, and semantic colors. Remove duplicated/obsolete styles only when no screen depends on them.

### Phase 4 — Feed and small-screen polish

1. Review filter discoverability, result context, pagination, and article action placement.
2. Design narrow-screen behavior intentionally for news cards, home actions, tables, and dialogs.
3. Verify English and Telugu wrapping, focus states, reduced motion, and accessible state announcements.

## First slice to implement

Start with Phase 1 items 1, 2, 4, and 5. They fix broken entry points and make feedback trustworthy without changing permissions or backend behavior. Then review the rendered screens before changing dashboard information architecture. The public survey is now reachable from sign-in and its recent responses appear in the staff workspace.

## Progress

- **Done in this pass:** Staff home is organized around daily office work and a separate tools area. Leader home emphasizes pending decisions, with alerts, suggestions, and team oversight in a secondary column. Leaders see post approvals and read-only projects; staff create drafts and update projects. The API enforces staff-only writes for watchlists, post drafts, project records, and WhatsApp intake, and leader-only post approvals. Compose and Projects use a shared themed frame with a Home return action and retryable loading errors. Shared `Input` and `Textarea` labels are now real associated labels. The watchlist prevents duplicates and names beyond five, and confirms successful saves. Added English and Telugu copy for new milestone screens.
- **Done in this pass:** Added a public `/survey` route linked from sign-in, with English/Telugu copy, accessible inputs, clear submission feedback, and no authentication requirement. Staff now see recent public responses with retry and empty states, and can expand the list. Saved posts can be printed or saved as PDF from the post list. Leader decisions remain the main page content; leader tools are grouped under a single action section. The staff workspace keeps intake and setup tools apart from story review, shares, and team work. Master admin remains the cross-office system control role. Removed unreachable image-upload code from Compose because the API does not store post images.
- **Done in this pass:** Applied the provided dashboard/feed visual direction: dark identity header with orange trim, five primary tabs, a real urgent-story strip, separate metric cards, and responsive news cards. Added the real representative directory under Official Portfolio and removed it from the live-news page. Staff/leader actions and server-backed data remain in place; no sample engagement or sentiment metrics were added.
- **Next:** Inspect these screens at phone and desktop widths, finish error/success feedback for the remaining feature widgets, and review the authenticated views with a staff and leader session.
- **Preview:** The signed-out sign-in page renders in the local web app. Authenticated role screens were not reviewed because they require a user session. The survey flow is now reachable from sign-in and directly at `/survey`.
- **Not verified:** No frontend build or automated checks have been run in this pass.

## Review checklist for each slice

- The primary task and next action are obvious for the signed-in role.
- Every visible control has a working result and gives feedback.
- Loading, empty, error, and success states are reachable and understandable.
- Layout works at phone, tablet, and desktop widths.
- English and Telugu content does not clip or overlap.
- Keyboard and screen-reader users can reach, operate, and understand controls.
- No invented sample metrics or fake activity are shown.
- Existing API permissions and data scope remain enforced by the backend.
