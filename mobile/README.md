# Nayak Mobile (Expo)

The phone app for Nayak. One login, same `users` table, roles and server-side
scoping as the web app (Phase 2 parity, M7-M13.2 done). Admin, MLA/MP,
minister and staff each get their own home, news feed, inbox and team board.

## Run
```bash
cd mobile/app
npm install
npx expo start
```
The app talks to `http://127.0.0.1:8000` in development by default (the local
backend, from an emulator/simulator).

### Pointing the app at another backend
`API_BASE_URL` always wins, in any profile:
```bash
API_BASE_URL=https://api.example.com npx expo start
```

### Demo tunnel
`scripts/demo_tunnel.sh` (repo root) starts a fresh Cloudflare quick tunnel on top
of the local backend and prints its URL. A quick tunnel address changes every
run, so it is never committed or hard-coded - pass it at start time:
```bash
API_BASE_URL=https://something.trycloudflare.com npx expo start
```
A real phone cannot reach `127.0.0.1`, so use the tunnel URL when testing on a
device.

### Demo logins
Use the `demo_*` accounts created by `./local.sh demo` (admin, MLA + 2 staff,
minister + 2 staff). Passwords are in `~/.config/ai-smart-office/demo-logins.txt`
(private, never committed). The real team logins (`aadi_srinivas`, `aadi_staff1`,
`aadi_staff2`) work too.

## Build (EAS)
`API_BASE_URL` is resolved per build profile by `app.config.js`:

| Profile | URL comes from | Default |
| --- | --- | --- |
| `development` | `DEV_API_BASE_URL`, else `API_BASE_URL` | `http://127.0.0.1:8000` |
| `preview` | `PREVIEW_API_BASE_URL`, else `API_BASE_URL` | none - build fails |
| `production` | `PRODUCTION_API_BASE_URL`, else `API_BASE_URL` | none - build fails |

`preview` and `production` must be `https://`; a missing URL stops the build
instead of shipping an app that points at localhost.

```bash
PREVIEW_API_BASE_URL=https://api.example.com npx eas-cli build --profile preview
```
Set these as EAS environment variables for repeatable builds (they are not
secrets, but they are per-deployment, so they stay out of the repo).

Store publishing requires explicit approval.

## Typecheck / Lint
```bash
npx tsc --noEmit
npm run lint
```

## Screens (Phase 2 parity)
- Login + forced change-password (12-char rule, no skip).
- Home per role: Control Room (admin), My Constituency (MLA/MP), State Overview
  (minister), Work Queue (staff).
- News: scope tabs, Latest/Archive, refresh with cooldown, per-card Telugu toggle.
- Inbox: status buttons, reply threads, unread badge.
- Team board + My team (leader) / Users (admin).
- Settings: change password, profile, notifications.

## What is still open
- M13.1: real-device test of all 4 roles on Android (needs a device).
- M13.4: EAS preview build (needs the user's yes).
See `mobile/TASKS.md` for the full list.
