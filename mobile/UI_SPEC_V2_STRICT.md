# Nayak mobile UI v2: STRICT spec (audit-driven). Supersedes the layout parts of UI_SPEC_FOR_FREEBUFF.md

Read `mobile/UI_SPEC_FOR_FREEBUFF.md` sections 1-3 (rules, tokens, real API facts) first: they still apply. THIS file overrides every layout/visual instruction in that file's sections 4-5 (F2-F9) wherever they conflict. If a rule here and a skill disagree, THIS file wins.

Repo: `/home/shiva/Projects/AI_SMART_OFFICE-main/mobile/app` (Expo SDK 58, Expo Router, TS strict). Audited on a real phone (1084x2412 px = 360x804 dp, density 3.0).

## A. What the audit found (these are the defects you are fixing)
1. Cards, chips, fields and the tab bar are 90% white (`rgba(255,255,255,0.9)`): the backdrop picture (flags, raised hand, swirls) shows THROUGH them. Edges melt.
2. Borders are `#ECE7DD` with no shadow: almost invisible. No layer reads as "in front".
3. The backdrop picture is full strength on every screen; text floats on it (Inbox, Team, More).
4. Inbox, Team, More are still the old default style: default header, raw usernames ("Leader: payal_shanker · You: payal_shanker"), heavy green button, "More" + duplicate "Settings" title, solid red Log out button, italic "None.".
5. News: brand bar + title + dark banner + note + scope card + toggle = the first story starts at ~51% of screen height (only 2 cards visible). The date chip looks tappable but is not. Raw timestamp "Latest story 18/11/2026, 11:29:32 pm".
6. A lighter horizontal seam sits behind the floating tab bar.
7. Home still draws a coloured icon tile for stories that have no picture.
8. The blue "Tools" circle is Expo Go's own dev overlay. IGNORE it, it is not app UI.

## B. STRICT RULES (any violation = the task is rejected and must be redone)
S1. One task per handover, in order V0..V9. Never start the next task. Never "also improve" anything not in the task. No refactors outside the task's files.
S2. Before coding print: (a) files you read, (b) files you will change, (c) tokens/components reused, (d) states covered. After coding print `git diff --stat`, `npx tsc --noEmit`, `npx eslint .`, and the section-E greps. All must pass. Paste REAL output. Never write "should work".
S3. Surfaces are OPAQUE. Forbidden anywhere outside `src/theme`: `rgba(255,255,255,` , any card/chip/field/sheet/tab-bar background with alpha < 1. Allowed alpha only for: the veil overlay (V0) and the dark banner on Home. Enforced by grep E1.
S4. No new colour, radius, font size, spacing or shadow literal outside `src/theme/index.ts` (grep E2). Add a token first, then use it.
S5. No `Alert.alert` except destructive confirmation. Success/error = inline caption or toast. No `console.log` left behind.
S6. Never show a username where a name exists (`politician_name` / leader name). Usernames appear only as a secondary caption in admin/team management lists.
S7. NEVER invent data or features (project rule): no fake counts, trends, photos, complaints, reports, create-news. An image area is drawn ONLY when a real `image_url` exists (and hidden if it fails to load); no placeholder tile, no image skeleton.
S8. No new dependencies. Everything needed is installed (expo-linear-gradient, expo-haptics, @expo/vector-icons, react-native-safe-area-context, expo-image is NOT installed: use RN `Image`).
S9. Do not edit anything outside `mobile/app` except: tick `mobile/TASKS.md`, one dated line in `STATE.md`. Backend/web/docs are forbidden (V10 backend work needs the user's explicit yes in chat first).
S10. Metro/phone protocol: the USER runs Metro (`cd mobile/app && adb reverse tcp:8000 tcp:8000 && adb reverse tcp:8081 tcp:8081 && API_BASE_URL=http://127.0.0.1:8000 npx expo start --android --localhost --port 8081`). You never start/stop/kill Metro or background servers. Before EVERY adb command run: `adb shell dumpsys window | grep -m1 mCurrentFocus` and continue ONLY if it contains `host.exp.exponent`. Otherwise STOP and tell the user "Nayak is not in front". Never launch, open or screenshot any other app. Screenshots go to the scratchpad only and are deleted after the report. Never type credentials into chat or files; test accounts are in `~/nayak-logins.csv` (read locally, never print).
S11. No commits, pushes, EAS builds, deploys, spending.
S12. Skills (read `~/.claude/skills/<name>/SKILL.md` first): `appllama-app-design-skill`, `antislop`, `antislop-ui`, `antislop-layoutmobile`, `antislop-human`, `apple-design`, `frontend-ui-engineering`, `incremental-implementation`, `code-review-and-quality` (run on your diff before reporting).
S13. If anything is ambiguous or a needed field/endpoint is not in `UI_SPEC_FOR_FREEBUFF.md` section 3, STOP and ask. Do not guess.

## C. The layering system (V0 builds it; every screen obeys it)
Layers, back to front: L0 page, L1 cards, L2 header band, L3 floating tab bar, L4 sheets/modals.
- L0 page: solid ivory `#F8F6F2`. The backdrop image (`assets/bg.jpg`, already in `app/_layout.tsx` `Backdrop`) stays but gets a VEIL on top of it: `LinearGradient` (expo-linear-gradient) absolute-fill, `colors=['rgba(248,246,242,0.20)','rgba(248,246,242,0.93)','rgba(248,246,242,0.93)','rgba(248,246,242,0.45)']`, `locations=[0,0.22,0.78,1]`. Result: swirl visible only in the top ~22%, leader silhouette only in the bottom ~22%, flat ivory in the middle. Put the veil colours in the theme as tokens.
- L1 cards/chips/fields: fill `#FFFFFF` (opaque), 1 px border `#E4DED3`, radius per tokens, shadow token `shadowCard = '0 1px 2px rgba(23,23,23,0.06), 0 6px 16px rgba(23,23,23,0.06)'` (use RN `boxShadow`). Grouped lists = ONE card with hairline dividers (`#ECE7DD`), not many cards.
- L2 header band: fill `#F8F6F2` solid. When the list is scrolled > 4 px a 1 px bottom border `#E4DED3` appears (via onScroll). Height = safe-area top + 56 dp. Title 24/700 left; actions right as 40x40 circles, fill `#FFFFFF`, 1 px border, icon 22 `c.text`. Only Home keeps the Nayak brand bar (`BrandBar`).
- L3 tab bar: fill `#FFFFFF`, 1 px border `#E4DED3`, radius 30, shadow token `shadowBar = '0 -1px 0 rgba(23,23,23,0.04), 0 10px 28px rgba(23,23,23,0.14)'`. The wrapper behind it is solid `#F8F6F2` with the same horizontal gutter, no seam, no transparency. Active tab = `accentBg` pill + `accentText` (unchanged). Inbox shows the unread badge.
- L4 sheets: opaque white, top radius 28, backdrop scrim `rgba(23,23,23,0.35)`.
- Text rule: text sits ONLY on ivory (L0 middle/L2) or white (L1). Never directly on the picture area (top 22% / bottom 22%) except the Home brand bar and the status bar.

## D. TASKS (strict order). Each lists files, exact spec, acceptance.

**V0. Layering + tokens.** Files: `src/theme/index.ts`, `src/ui/index.tsx` (Card, Badge, Pill, Row), `src/ui/FloatingTabBar.tsx`, `src/ui/HomeParts.tsx` (HeaderButton, QuickActions, SummaryCard bg stays), `src/ui/NewsParts.tsx`, `app/_layout.tsx` (veil), `app/(tabs)/_layout.tsx`.
 Do: add tokens `surface = '#FFFFFF'`, `line = '#E4DED3'`, `hairline = '#ECE7DD'`, `shadowCard`, `shadowBar`, `veil` colours. Make `palette.light.card` opaque `#FFFFFF`. Replace every `rgba(255,255,255,...)` surface with the tokens (the Segmented/chips/DateChip/HeaderButton/fields/tab bar). Add the veil to `Backdrop`. Tab bar wrapper solid ivory, remove seam.
 Accept: grep E1 prints nothing; phone screenshots of Home and News show NO picture visible behind any card/row/chip; no seam above the tab bar; tsc+eslint clean.

**V1. Shared building blocks.** Files: `src/ui/` (new `ScreenHeader.tsx`, `StickyBar.tsx`, `GroupedList.tsx`, `Toast.tsx`; reuse `Segmented`, `ScopeTabs`, `PresetChips` from `NewsParts`).
 - `ScreenHeader({title, subtitle?, onBack?, actions?: {icon,label,onPress,badge?}[]})`: spec in section C L2; exposes `scrolled` styling prop. accessibilityRole header.
 - `StickyBar`: wrapper with solid ivory fill + bottom hairline; used as FlatList `ListHeaderComponent` with `stickyHeaderIndices={[0]}`. The screen title header is a FIXED View ABOVE the list (never inside it).
 - `GroupedList({sections:[{title?, rows:[{icon, iconColor, title, value?, onPress?, danger?, switch?}]}]})`: one white L1 card per section, rows min 52 dp, icon in a 32x32 radius-10 tinted square, value right-aligned muted 15, chevron 20 when pressable, hairline dividers inset 60 dp. Section title 13/600 uppercase-free muted above the card.
 - `Toast`: bottom inline pill above the tab bar, auto hides 2.5 s, `accessibilityLiveRegion="polite"`.
 Accept: each used by at least one screen in V2-V5; no hex/rgba literals; tap targets >= 44.

**V2. News (compact).** File: `app/(tabs)/news.tsx` (+ `NewsParts.tsx`). Keep ALL existing logic (queries, social mixing, refresh polling, translate, paging, sentiment tones).
 - DELETE `PlaceBanner`, `DateChip` and `PageTitle` usage. Layout: fixed `ScreenHeader` title "News", subtitle `${place} · Updated ${relative}` (use `relativeTime`, never a raw locale timestamp), actions = [search, refresh]. Refresh icon shows a spinner while refreshing and the cooldown seconds as a tiny caption in the subtitle (no pill).
 - Search: tapping the search icon turns the header into a search field (TextField-like, 44 dp, Cancel text button); debounce 400 ms; add `search` to `fetchNews` params in `src/api/news.ts` (backend `/api/news` already accepts `search`); empty result state "No stories match".
 - Sticky bar (ListHeader, `stickyHeaderIndices={[0]}`): row 1 `ScopeTabs` (6 scopes, fixed equal-width, NO scrolling, counts capped at "999+"), row 2 `Segmented` Latest | Archive (left aligned, height 40). Archive shows `PresetChips` (wrap). Total sticky height <= 108 dp.
 - Story card keeps the current look (3 dp left tone edge, pill, headline 15/700 max 3 lines, summary max 2, meta line, Share + తెలుగు). Picture ONLY when `image_url` loads.
 - Long-press a card = bottom sheet with Share / Copy link / Report story (`POST /api/feedback/story` kinds not_relevant|wrong_priority|wrong_sentiment, needs `title` and optional `article_id`, note). Add `reportStory()` in `src/api/news.ts`.
 Accept (measured on a 1084x2412 screenshot): the top edge of the FIRST story card is at y <= 700 px; at least 3 cards visible with no picture; scope row shows all 6 labels untruncated; no horizontal scroll anywhere; Telugu headline not clipped at system font scale 1.3.

**V3. More (settings hub).** File: `app/(tabs)/settings.tsx` (route name stays `settings`, tab label "More"). Reuse the existing notification-registration logic verbatim.
 - `ScreenHeader` title "More" only (no second "Settings" title). Profile card (L1): `Monogram` 64, name 20/700 (`politician_name` or `username`), caption `leader_title · leader_party` (omit nulls), caption constituency (omit if null).
 - `GroupedList` sections: ACCOUNT (Contact details -> sheet with email + phone TextFields, `GET/PUT /api/me/profile` fields email, phone, alerts_enabled, lang; Language segmented English | తెలుగు stored via the same PUT), NOTIFICATIONS (Push switch = existing logic; Email alerts switch = `alerts_enabled`; "Send me a test alert" = `POST /api/me/test-alert`, show result inline/toast, hide if `email_configured` is false), SECURITY (Change password -> `/change-password`; Sign out of all devices = `POST /api/logout` with no body, confirm via action sheet), TEAM (Sent shares -> `/(tabs)/sent`, hidden for admin; My team -> `/my-team`, only mla/minister), HELP (Send feedback -> sheet, `POST /api/feedback/app` message 3-2000 chars), ABOUT (Version from `expo-constants`, Build = `BUILD_PROFILE`, Server status row calling `/api/health`: "Connected" / "Not reachable"). Last card: single row "Sign out" in `c.danger` (existing signOut logic). NO big red button.
 Accept: every row maps to a real function; PUT profile sends all 4 fields; screenshot shows no picture behind rows; tsc+eslint.

**V4. Inbox (+Sent).** Files: `app/(tabs)/inbox.tsx`, `app/(tabs)/sent.tsx`, `app/share/[id].tsx`.
 - `ScreenHeader` "Inbox" (+ unread caption). Sticky bar: `Segmented` Received | Sent; below it for Received `FilterChips`-style row All / New / Acting / Done (single row, no scroll).
 - Received rows in ONE grouped card: unread dot 8 dp `c.accent`, title 15/700 max 2 lines, caption `from {sender display} · {relative}`, Badges (Urgent danger; status New=attention, Seen=neutral, Acting=attention, Done=success), reply count. Urgent first, then newest. Sent rows: title, "to N people", per-recipient status chips. `sent.tsx` becomes a thin redirect/wrapper so existing links work.
 - Empty state (composed, in a white card): icon, "No shares yet", hint "When someone shares a story with you it appears here.", and for staff a primary Button "Share a story" -> `/share/create`.
 - Detail: `ScreenHeader` with back; card with title, sender/time, summary, quoted note block, "Open source" link; status `Segmented` Seen | Acting | Done (optimistic + rollback + haptic); replies as bubbles (mine right on `accentBg`, others left on white, radius 18); composer pinned above the keyboard (TextField + send, counter > 1800/2000).
 Accept: empty state matches; opening a share lowers the tab badge; reply works; tsc+eslint.

**V5. Team + My team.** Files: `app/(tabs)/team.tsx`, `app/my-team.tsx`.
 - `ScreenHeader` "Team"; leaders get a header action (groups icon) -> `/my-team` (REPLACES the green "Manage my team" button). Summary card: "Team of {leader name}" with a row of Monogram avatars (max 5 + "+N") and caption "You can view tasks and add notes" for leaders / "You manage tasks" for `can_manage`. NO "Leader: x · You: x · Members: ..." text.
 - Sticky `Segmented` To do | Doing | Done with counts. Task card: title 15/700, caption `{assigned_to display or 'Unassigned'} · due {date}`, Badge Overdue (danger) when due < today and not done, notes count; tap expands notes. Staff: "Move to Doing / Done", Reassign (sheet), "Add task" primary Button (sheet: Title, Note, Assign chips, Due `YYYY-MM-DD` validated). Empty column state: icon + "Nothing here yet".
 - Briefing card for staff (English | తెలుగు segmented, text area, Save, Reset to automatic); leaders read-only.
 - `my-team.tsx`: header with back; grouped list rows (Monogram 40, name/username, "Last sign-in {relative}" or Badge Disabled); row tap = action sheet (Reset password, Disable/Enable); "Add staff" primary Button -> sheet (username, password >= 12 chars with the rule shown). Inline success/error, no Alert popups.
 Accept: leader sees tasks read-only; staff creates + moves a task; tsc+eslint.

**V6. Home touch-ups.** Files: `app/(tabs)/index.tsx`, `src/ui/HomeParts.tsx`.
 - `NewsItem`: remove the coloured tile entirely (no picture -> text only, full width). Keep sentiment/urgent badges. (Dashboard stories carry no `image_url`; do NOT fake one.)
 - Replace any raw timestamp by `relativeTime`; add caption "Updated {relative}" under "Today's News".
 - Summary cards, quick actions, reach card: opaque fills per V0; nothing else changes.
 Accept: Home screenshot shows no tiles for stories, no picture behind any card; tsc+eslint.

**V7. Login, Change password, Share create, Users (admin).** Files: `app/(auth)/login.tsx`, `app/change-password.tsx`, `app/share/create.tsx`, `app/(tabs)/users.tsx`. Apply V0-V1 blocks: login = brand + one white card + inline errors + "Forgot your password? Ask your office admin to reset it." + version caption; change-password forced mode hides back; share create is a modal with Close; users = search + role chips + grouped list + action sheet (reset password, disable/enable; admins cannot be disabled).
 Accept: forced password flow cannot be skipped; tsc+eslint.

**V8. Tab bar + navigation polish.** Re-tapping the active tab scrolls its list to top (use `useScrollToTop`-style per-screen ref via expo-router/react-navigation hooks already installed; if not available STOP and ask). Haptic tick on tab change (already). Verify Android back never traps; sign-in cannot be returned to after login.

**V9. QA + proof.** On the phone (S10 protocol) capture Home, News, Inbox, Team, More, Login (log out first only if the user allows), Share detail, My team. For each, fill this table in the report: `screen | first content item top (dp) | picture bleeding through (yes/no) | raw username shown (yes/no) | any Alert popup (yes/no) | tap targets < 44 dp (count) | text clipped at font scale 1.3 (yes/no)`. All "no/0" except first-item-top (News <= 230 dp). Run `code-review-and-quality` on the whole diff; fix findings. Update `mobile/README.md`, tick `mobile/TASKS.md`, one line in `STATE.md`.

**V10 (NOT allowed without the user's explicit yes in chat).** Backend: add `image_url` to dashboard stories so Home can show real pictures.

## E. Mandatory greps (run after EVERY task, paste output)
E1: `cd mobile/app && grep -rnE "rgba\(255, ?255, ?255|backgroundColor: ?'#?[fF]{3,6}'" app src | grep -v "src/theme"`  -> must print nothing.
E2: `grep -rnE "#[0-9a-fA-F]{3,8}\b|borderRadius: ?[0-9]+|boxShadow: ?'" app src | grep -v "src/theme"` -> nothing (move literals into the theme).
E3: `grep -rn "Alert.alert" app src` -> only destructive confirmations (list each with a one-line reason).
E4: `grep -rn "console.log" app src` -> nothing.
E5: `npx tsc --noEmit && npx eslint .` -> clean.
