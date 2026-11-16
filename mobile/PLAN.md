# Mobile app plan (Expo / React Native), draft for approval

Goal: MLAs and their staff get Telangana news and admin shares on their phone, and can act on them in seconds. Admin gets a lighter version. Same backend, no rewrite.

## What the backend already gives us
Token login, `/api/me`, scoped `/api/news`, `/api/translate`, and all 8 `/api/shares/*` endpoints (inbox, unread, status, replies, sent, targets). The mobile app calls these as they are.

## Backend work the phone needs (M0)
| Gap | Why | Work |
|---|---|---|
| Server reachable from a phone | Today it only runs on this laptop (127.0.0.1) | Host the backend on HTTPS (your choice of host), set `API_BASE_URL` in the app |
| Session length | Token lasts 8 hours; phones should stay signed in for days | Refresh-token or longer expiry for mobile, rotated on use |
| Push tokens | Notify an MLA the moment admin shares | New table `device_tokens` + `POST /api/devices` (register/unregister) |
| Send push on share | Same trigger as inbox | In `create_share`, push to each recipient (Expo Push API) |
| Rate limit / validation | New public endpoint | Limit per user, validate token format |

## App screens
1. Login (secure token storage with expo-secure-store; no password stored)
2. Inbox: unread badge, urgent first, pull to refresh
3. Share detail: note, summary, open source link, status buttons (seen / acting / done), reply thread
4. News feed: scoped to the MLA's constituency, tabs All / Positive / Negative, English/Telugu toggle, 20 per page
5. Admin only: share from a news card (recipient picker), Sent list with per-recipient status
6. Settings: language, notifications on/off, log out

Not in v1: creating users, social media tab (web only until real engagement data exists), tasks.

## Stack
Expo SDK (current), TypeScript, Expo Router, TanStack Query for server data, expo-secure-store, expo-notifications. Same Bearer-token calls as the web `apiFetch`.

## Phases (check in after each one)
| Phase | Work | Weight |
|---|---|---|
| M0 | Backend readiness: HTTPS hosting, longer session, device tokens + push sender, tests | 20% |
| M1 | App scaffold, login, secure token, API client, 401 handling | 10% |
| M2 | Inbox, detail, status, replies, unread badge | 25% |
| M3 | News feed, pagination, Telugu/English | 15% |
| M4 | Push notifications end to end (needs your Expo/Firebase account) | 15% |
| M5 | Admin: share from card, Sent view | 10% |
| M6 | Test on a real phone/simulator, accessibility pass, build with EAS | 5% |

## Needs from you (I will not ask for passwords in chat)
- Where to host the backend (a server with HTTPS and a real Postgres)
- An Expo account, and a Firebase project for Android push (you create them and add the keys yourself)
- Android only, iOS only, or both (iOS needs an Apple developer account, paid)
- App name and icon preference

## Order of work I recommend
M0 first (nothing works on a phone without a reachable server), then M1 to M3 so the MLA flow works without push, then M4, then M5. Deploying, publishing to stores and spending money each need your explicit yes.
