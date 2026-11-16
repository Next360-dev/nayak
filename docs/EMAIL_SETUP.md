# Turn on email alerts and the morning briefing (about 10 minutes)

The app can email each person: an urgent story that was shared with them, a morning briefing, and (for the admin) a warning
if the news stops or a leader ignores a share. It is OFF until you give it an email account to send from. The app never
sends anything without this.

## Step 1: get an email account that can send (you do this once)
Pick ONE of these. The "app password" idea is the same everywhere: a separate password just for programs, so your real
password is never stored.

**A. A Gmail address made just for this (easiest to start)**
1. Create a new Gmail, for example `yourorg.smartoffice@gmail.com`. Do not use your personal one.
2. In that Google account, turn on 2-Step Verification (Security page).
3. Search "App passwords" in the Google account, create one named "Nayak". Google shows a 16-letter password. Copy it.
4. Use these in step 2 below: server `smtp.gmail.com`, port `587`, username = the full Gmail address, password = the 16-letter
   app password.
   (Gmail limits sending to a few hundred emails a day, fine for a pilot.)

**B. Your organisation's or a mail service's SMTP details**
Ask whoever runs your email (or the mail service's help page) for: server name, port (usually 587), username, password.
Services that offer free starter plans exist (for example Brevo, Mailjet, Zoho); the steps on their sites differ, but they
all end with those four values.

## Step 2: give the app those details
Open a normal terminal (not the chat box), then:
```
cd /home/shiva/Projects/AI_SMART_OFFICE-main
./local.sh email-setup
```
It asks 5 questions (the password is hidden as you type), saves them privately outside the project, and sends a test email.
If the test fails it tells you in plain words what to fix (for example "use an App Password").

Then restart so the app picks it up:
```
./local.sh stop && ./local.sh start
```

## Step 3: each person adds their own email
In the app: person icon (top right) > "Contact & alerts" > type email > Save > "Send me a test email".
Leaders and staff should also choose the language they want the emails in (English or Telugu).

## What gets sent, and when
| Email | To | When |
|---|---|---|
| Urgent story shared | the person it was shared with | right away, only for shares marked urgent |
| Morning briefing | everyone with an email | once a day after 7 am (India time) |
| "News looks stale" | admins | once, when no new stories arrive for 6 hours |
| "Share not opened" | admins | once per share left unopened for 24 hours |

Each message is sent at most once. Anyone can switch alerts off in "Contact & alerts". Change the briefing hour with
`BRIEFING_HOUR=8` in the same private settings file.

## If something does not arrive
1. `./local.sh email-test your@address` says what is wrong.
2. Check the spam folder.
3. Gmail users: it must be an App Password, and the "from" address must be the same Gmail address.
4. The Control Room's Activity log and `./local.sh logs` show failures.
