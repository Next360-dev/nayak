# Nayak UI/UX audit and redesign plan

Status 2026-11-23: U0-U6 built (see mobile/TASKS.md Phase 4). Open: dark mode, web pass, on-device check.

Scope read so far (code level): mobile Home, tab bar, Inbox, Story, News (top), Login, theme, UI kit.
Not yet read: Team, Users, Settings, Work screens, Share screens, Change-password, all web screens (web needs a
real-browser pass at 375/768/1440). Findings below are from reading the code; the Inbox bugs need a device check.
Combines with `ENGAGEMENT_PLAN.md` (Itch / Lazy Thumb / Paved Path / Slot Machine / Bottomless Pit / Piggy Bank).

## A. Bugs found (fix first, no design debate)
| # | Where | Problem | Fix |
|---|---|---|---|
| B1 | Inbox (`(tabs)/inbox.tsx`) | Received shares look rendered twice: once in the `GroupedList` header and again by the FlatList rows | Keep one list (the richer FlatList rows), drop the header list |
| B2 | Inbox | `items.sort(...)` sorts the React Query cache array in place when filter = All | Copy first: `[...items].sort` |
| B3 | Inbox | No loading or error state: shows "No shares yet" while loading | Skeleton + retry, same as Home |
| B4 | Tab bar | Tab press uses `router.push`, so every tap grows the back stack | Use the tab navigator's `navigate` |
| B5 | Story | Story opens from an in-memory cache: after app restart or a notification tap it says "no longer available" | Fetch by id when the cache misses (needs `GET /api/news/{id}` check) |
| B6 | Inbox | Hard-coded colours and a second copy of `relativeTime`; `Toast` never used; helper named `TextFieldLike` | Use theme tokens and `lib/time` |

## B. Design findings: where I'd change, and why
1. **Leader Home buries the leader's real job.** The product rule says staff do the work and the leader answers.
   Mobile Home shows Summary then News then Reach. The web already has "Picked for you" with one-tap
   Seen / I'll act / Done. Change: mobile leader Home = 3 big numbers, then "Picked for you" cards with one-tap
   answers, then "Needs attention". Why: first screen should answer "what is waiting for me", in under 5 seconds.
2. **Staff Home should be a work queue.** Same idea: "Stories to review" with a big Send to MLA button first.
3. **Share is not the primary action on a story.** Story screen has "Read full story" as the big gold button and
   Share small. For staff, sharing up is the core loop. Change: primary = Share (staff) / Save (leader); "Read
   full story" becomes secondary. Why: Paved Path.
4. **Inbox rows need one-tap status.** Today you open the share, then change status. Add swipe or inline chips
   (Seen / Acting / Done) on the row. Why: Lazy Thumb.
5. **Too many accent colours.** Palette says "one muted gold", but the UI also uses forest green (selected tabs),
   violet, blue and green quick-action tints. Change: gold only for action and selected, status colours only for
   status; quick actions become one neutral icon style. Why: calm, official, and the colour then means something.
6. **Login is the weakest screen.** Raw `StyleSheet`, `TouchableOpacity`, plain title, no brand, no show-password,
   no keyboard avoid. Change: branded header (name + saffron/green flag bar already in tokens), larger fields,
   show/hide password, "Forgot? Ask your admin" line, keyboard-aware layout.
7. **Dark mode is built but switched off** (`useTheme` returns light only because of the background image).
   Leaders read at night. Change: plan a real dark theme after tokens are cleaned; keep the image optional.
8. **Telugu typography.** There is a Telugu translate button, but body text has no line-height. Telugu needs
   about 1.6 line-height or marks clip. Add `lineHeight` to `body` and `caption`, test with Telugu text.
9. **Small text.** Tab badge is 10 px; captions are 12 px. Raise tab label to 12 and badge to 11; keep captions
   at 12 only for secondary meta.
10. **Naming drift.** Admin Home says "MLAs + MPs"; the role is "minister". Pick one word everywhere.
11. **Admin Home is a long scroll of 6 sections.** Change: health strip + "Needs attention" first, the rest
    collapsed under "Accounts / Shares / Leaders". Why: admin opens it to check whether anything is broken.
12. **Empty states are plain.** Empty Inbox says "No shares yet". Better: say what to do next and give one button
    (staff: "Find a story to share").

## C. Order of work (small slices, check-in after each)
- U0 Bugs B1-B6 (+ tests where there is backend change). Tiny, safe.
- U1 Tokens and kit cleanup: one accent rule, type lineHeight, text sizes, naming. Then every screen inherits it.
- U2 Leader and staff Home rebuilt (finding 1, 2) + Story primary action (3).
- U3 Inbox one-tap status + row design (4), empty states (12). This is also engagement E1.
- U4 Login rebuild (6).
- U5 "New since last visit" + caught-up end of feed + saved stories (engagement E2, E3).
- U6 Admin Home trim (11). Dark mode (7). Push (engagement E4) only after you create the Expo/Firebase account.
- W Web pass: real-browser audit at 375/768/1440 for every role, then the same rules applied to the web.

Checks per slice: `tsc` and lint clean, `npm run build`, backend tests on a throwaway DB, screenshots before/after,
tick TASKS.md, update STATE.md. Antislop delivery gate before each "done".
