# Engagement plan (draft, needs approval before any code)

Source of the six ideas: no public source uses these exact labels. They match the Hooked model
(Trigger, Action, Variable reward, Investment) plus well-known habit patterns. Research notes at the bottom.

Rule for Nayak: users are officials at work. Real data only (no invented counts), no guilt or fake-urgency
notifications, easy to switch everything off. Stickiness = the app saves them time.

| # | Idea | Hooked stage | What we build | Needs backend? |
|---|---|---|---|---|
| 1 | The Itch | Trigger | Push: morning briefing ("N new stories for your area, M shares waiting"); push on a new share or reply. Ask permission AFTER first login success, with one line saying why | Yes: device token table + send job (needs Expo/Firebase account, ask user) |
| 2 | The Lazy Thumb | Action | One-tap seen / acting / done on a share; swipe actions on a story; share sheet remembers last recipient | No (APIs exist) |
| 3 | The Paved Path | Action | After reading a story: "Share" then "Add to team board" as the obvious next buttons; after replying, return to inbox, not a dead end | No |
| 4 | The Slot Machine | Variable reward | NOT a casino lever. Honest version: "new since your last visit" marker and count from real data; positive/negative news mix is already real variety | Small: store last-seen time |
| 5 | The Bottomless Pit | Variable reward | Related stories under a story; keep paging; end-of-feed "you're caught up" message (healthy stop, not endless) | Maybe: related-by-constituency query |
| 6 | The Piggy Bank | Investment | Saved stories; share/task history; weekly "what you handled" summary built from real rows | Yes: saved-stories table; summary is a query |

## Suggested order (small slices, check in after each)
- E1: Lazy Thumb + Paved Path (mobile only, no backend). Lowest risk, instant win.
- E2: "New since last visit" + caught-up end of feed.
- E3: Saved stories (Piggy Bank, part 1).
- E4: Push notifications (Itch). Blocked on your Expo/Firebase account; backend token table + tests first.
- E5: Weekly summary (Piggy Bank, part 2).

Checks per slice: tsc + lint clean, web build, `pytest` on throwaway DB, tick in TASKS.md, update STATE.md.

## Research notes
- Hooked model: Trigger, Action, Variable reward, Investment (Nir Eyal, 2014). Design heuristic, not proven science.
- Variable reward and pull-to-refresh as "slot lever" is a widely cited critique (Tristan Harris; the gesture's designer regrets it). So we copy the idea of fresh content, not the compulsion.
- Push: ask permission after a key action, not at first launch; explain the value; rising opt-out means too many or irrelevant messages. Vendor blogs (OneSignal, Airship, MoEngage), so treat numbers as directional.
