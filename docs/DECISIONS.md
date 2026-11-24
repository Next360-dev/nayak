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
- Identity bar (web LeaderIdentityBar + phone Hero): shown for every leader and every staff member; staff see their LEADER (same photo, party, place) from GET /api/portfolio (now also returns leader_title/party/constituency/district). Photo = Portfolio avatar_url; the old hard-coded Aadi portrait is only a fallback on the web until his office saves a photo. No party badge unless known.
- 2026-11-24 Leader profile: Profile page shows the leader's own data (photo, title, party, place, biography, offices) from the portfolio; staff see their leader plus their own login. Home top bar: leader's photo/name for everyone, and staff also get 'Signed in as <login>'. Leader photos are data (scripts/seed_leader_photos.py, unpublished, never overwrites a photo an office set).
- 2026-11-24 PROPOSED: rebuild the navigation shell once (docs/UX_ARCHITECTURE.md): five areas Today / Work / Constituency / Media / Me for every role, module registry drives sidebar + hubs + search, shared page template; web gets a left sidebar. Why: 36 modules cannot fit the news-era 5 tabs.
- 2026-11-24 PROPOSED: backend by vertical slices (app/modules/<name>/ router, schemas, service, repository, jobs), separate job worker with job_runs + advisory locks + deep health, one HTTP client with retries/breaker and provider fakes, office_scope isolation tests from a module registry, CI gates (ruff, mypy strict, coverage). Details in docs/BACKEND_ARCHITECTURE.md (step W0 first).
- 2026-11-24 PROPOSED: navigation uses the five product pillars (Today / Intelligence / Constituency / Office / Me + Assistant); metrics layer in W0; Legislative needs a data-source spike first (docs/PRODUCT_PILLARS.md).
