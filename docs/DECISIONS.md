# Architecture decisions (one line each: date, decision, why)

- 2026-11-14 Server enforces all role/scope rules; UI only mirrors them. Why: UI checks can be bypassed.
- 2026-11-14 No fabricated data anywhere (posts, engagement, authors, dates). Why: trust with political users; unknown stays unknown.
- 2026-11-15 Staff are the engine, leaders look only. Why: leaders have little time; build tools for staff.
- 2026-11-23 Social crawl: several query variants, items must name the person, failures logged, 429 retried once, 2 min manual cooldown, max 3 concurrent crawls, auto background refresh when data is older than 3 h. Why: one exact query found nothing for most MLAs; protect against being blocked.
- 2026-11-23 Social tone has a neutral class; reasons name matched words. Why: "positive by default" was a guess. (News neutral fallback stays OFF: owner's call.)
- 2026-11-23 API docs off by default. Why: the public tunnel exposed the full endpoint map.
- 2026-11-23 Demo hosting: backend on owner's PC, Cloudflare quick tunnel, Vercel rewrite in `frontend/vercel.json`. Why: no hosting budget yet; replace with a VPS.
- 2026-11-23 Proprietary license, copyright Next360; no AI attribution in git history. Why: owner's decision.
- 2026-11-24 Milestone order: phone parity with web first, then features B1-B8; OpenCode builds from `docs/MOBILE_MILESTONE.md`. Why: usage limits; keep the agent on architecture and review.
