# Pilot guide: one week with 2 or 3 real people

Goal: find out what confuses real users and whether the news is useful, BEFORE anyone talks about deploying.
Nothing here needs code. You (the admin) run it; the app collects the evidence.

## Before day 1 (30 minutes)
1. `./local.sh backup` (a safe copy of your data).
2. `./local.sh start`, open the app, log in as admin. Change the admin password (person icon > Password) and delete
   `~/.config/ai-smart-office/admin-login.txt`.
3. Create the pilot accounts under Users > Create user: one **MLA** (real constituency), one **staff** member for that MLA,
   and optionally one **minister** with one staff member. Give each person their username and a first password, and ask them to
   change it (person icon > Password).
4. Ask each person to open the person icon > "Contact & alerts" and add their email and phone.
5. Remove the demo accounts: `./local.sh demo --remove`.
6. (Optional, 10 minutes) Turn on email alerts: `docs/EMAIL_SETUP.md` (`./local.sh email-setup`). Without it the app still works;
   people just are not emailed. Briefings can also be sent by WhatsApp from the Briefing button.
6b. (Optional) Real contact numbers: `./local.sh contacts-sheet`, fill phone/email, then Users > Import contacts.
6c. Ask a Telugu speaker in the pilot to review the wording: `./local.sh telugu-review export` (see docs/DEPLOY.md).
7. Give everyone the link (this computer's address must be reachable by them; if not, run the pilot on one screen with them
   sitting next to you).

## What each person should try (about 15 minutes, day 1)
- **Staff:** find 3 stories worth the leader's attention, send them up with a note, mark one urgent. Report one story that is
  wrong (flag icon). Press "Feedback" and write one honest sentence.
- **MLA / minister:** open the Shared inbox, move a story to "Acting", reply, then send one story down to your staff. Press
  "Briefing" and copy it into WhatsApp. Add a second staff member under "My team".
- **Admin:** open the Control Room every morning (2 minutes): anything under "Needs your attention"? Read "User feedback"
  and "News quality". Open Activity log once to see it is recording.
- **Everyone:** switch to Telugu with the language button and say if any wording is wrong or odd.

## What to watch for (write it down, do not explain the app to them)
- Where do they hesitate or ask "where is...?"
- Do they find the Share / Send button without help?
- Do they open the app on their own on day 2, 3, 4? (Control Room > Leaders shows last login.)
- Do urgent shares get opened within a day? (Control Room > Leaders and "Needs your attention".)
- Which stories do they report as wrong, and why?

## Measure the news accuracy (once, day 3, 30 minutes)
1. `cd backend && python scripts/quality_sample.py 100 ~/review.csv` (a random sample of today's stories).
2. Ask the MLA's staff member to fill two columns per row: `your_priority` (1 urgent / 2 civic / 3 standard) and
   `your_sentiment` (positive / negative).
3. `python scripts/quality_score.py ~/review.csv` prints the accuracy of "urgent" and "negative".
   Suggested target before wider use: **at least 85% right on "urgent"**. If lower: try the free local AI (`docs/LOCAL_AI.md`, `./local.sh ollama-check`) or revisit the keyword rules. (A Gemini key does NOT change the tone in the live pipeline; see PRODUCT_MAP.)

## End of week review (45 minutes, all pilot users together)
Ask: What did you use most? What did you never touch? What was confusing? What would make you open it every morning? Would you
miss it if it were gone? Then read Control Room > User feedback and the Activity log.

## Success looks like
- Every pilot user logged in on at least 4 of 7 days without being reminded.
- At least 80% of urgent shares were opened within 24 hours.
- No one needed help to send or reply.
- "Urgent" accuracy at or above the target.
- The top 5 complaints are written down and fixed or consciously postponed.

## Stop and fix first if
- Anyone sees data that is not theirs (report it immediately; scope rules are tested but real use is the real test).
- The Control Room shows the news as stale for more than a day.
- Logins fail for no reason (check Activity log for "Failed login" and `./local.sh logs`).

## Afterwards
`./local.sh backup`, then decide: deploy (needs a hosting choice and HTTPS), build the mobile app (paused), or keep improving.
