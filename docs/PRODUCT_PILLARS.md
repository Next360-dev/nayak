# The five product pillars, mapped onto everything we planned. Written 2026-11-24, status: PROPOSED

Source: the product spec's five pillars. This page is the one place that ties the pillars to the 36 modules, the UX shell (`UX_ARCHITECTURE.md`), the backend (`BACKEND_ARCHITECTURE.md`) and the Python-first approach. When a plan and this page disagree, fix the plan.

## 1. Pillars -> modules -> where we stand
| Pillar | What it promises | Modules (of 36) | Built today |
|---|---|---|---|
| 1 Political Intelligence | Competitor alerts, news monitoring, public social-media intelligence | 2 Competitor/watchlist alerts, 26 News, 27 Social | 26 and 27 done (basic), 2 partial |
| 2 Legislative Intelligence | Official records, questions, speeches, debates, government responses | 3 Legislative inbox | nothing (1 module, but the hardest: depends on data sources) |
| 3 Constituency Management | Grievances, projects, field operations, schemes, citizen services | 5, 6, 11, 12, 14, 17, 18, 19, 32 | 6 and 17 done (basic) |
| 4 Office Administration | Letters, appointments, meetings, staff tasks, approvals, records | 4, 7, 8, 9, 10, 13, 15, 16, 20, 28, 29, 30, 31, 34 | 8 and 34 done, 13 and 28 partial |
| 5 AI-Powered Assistance | Daily briefings, document understanding, drafting, voice, cross-system search | 21, 22, 23, 24, 25 | 24 and 21 partial (rules/text only) |
| Platform (not a pillar, serves all) | Dashboards, notifications, security, roles | 1, 33, 35, 36 | 33, 36 done; 1, 35 partial |
Counts: 3 + 1 + 9 + 14 + 5 + 4 = 36.
**Observation:** the pillars are lopsided. Office Administration holds 14 modules; Legislative Intelligence holds 1. A pillar we sell on the front page with one module behind it must be built deep (see section 3), or we do not lead with it.

## 2. Reconciling the pillars with the navigation (changes to UX_ARCHITECTURE.md)
The client thinks in pillars, so the shell uses the pillar names. Phone has 5 tabs; the web sidebar shows the full pillar list.
| Phone tab | Web sidebar section | Pillars inside |
|---|---|---|
| Today | Today | Platform: dashboard, briefing, notifications |
| Intelligence | Political + Legislative Intelligence | pillars 1 and 2 (both are "what is happening and what was said") |
| Constituency | Constituency Management | pillar 3 |
| Office | Office Administration (leaders see it as "Decisions") | pillar 4 |
| Me | Me | profile, portfolio, directory, admin |
| Assistant (floating button, every screen) | Assistant (top bar + panel) | pillar 5 |
Renames versus the earlier plan: Media -> Intelligence (now also holds Legislative), Work -> Office. Everything else in the UX plan stands.

## 3. Pillar by pillar: what to build, in Python first
**1 Political Intelligence.** Gazetteer of every leader/official/place (Telugu + English spellings) for exact entity matching; tone and priority = rules plus a small model trained on the "Report story" labels, with an accuracy report in CI; per-source adapters with alerts when a source changes. Rule from the spec: public sources only, within each platform's terms; never promise private-account monitoring. Alert path is measured end to end (see section 5).
**2 Legislative Intelligence.** Start with a **data-source spike** (a few days, before any UI): which official sources exist, in what form (web, PDF, video), how stable, what licence. Design from the spec's accuracy rule: store questions, answers, speeches, debates and topic mentions as SEPARATE record types, each with its official source link and a verified/unverified flag; never merge them into one activity score. Python: parsers per source, OCR (Tesseract + Telugu pack) for PDFs, human verification queue. Lead with this pillar only after the spike proves the data.
**3 Constituency Management.** Grievance lifecycle with SLA clock, escalation and verified resolution; projects with evidence; field app with geotagged proof (offline sync); map reads grievances + projects. Python: state machines, scheduled reminders in the job worker, evidence required to mark "completed" (spec rule: a post alone is not proof).
**4 Office Administration.** One record engine (letters already prove it): owner, status, due date, history, files. Visitors, appointments, meetings, handover, delegation, approvals all reuse it, so 14 modules do not mean 14 designs. Python: the generic engine + per-module config; delegation is the one place that changes the permission model (build carefully, test hard).
**5 AI-Powered Assistance, Python-first.** Briefing = deterministic templates over real numbers; drafting = approved templates with placeholders; summaries = extractive (sentences from the source, with links); search = PostgreSQL full text + trigram; assistant = intent rules over known data. An LLM is an optional plug-in per office, always with human review (spec rule: no automatic publication or reply). This is the honest meaning of "AI-powered" for us: assistance that is auditable.

## 4. Spec rules turned into engineering rules (apply to every module)
1. Human in control: nothing AI-made is sent, published or acted on without an authorised approval (enforced in the service layer, tested).
2. Evidence: an activity or project is "completed" only with evidence attached; announced / in-progress / completed are separate states.
3. Source links: every legislative or news item links to its source; unverified items are labelled.
4. Sensitive records: grievances, citizen contacts, internal letters, staff records have role-scoped access, retention rules and an access log.
5. Measure outcomes, not logins (next section).

## 5. The measurement layer we do not have yet (from the spec's pilot metrics)
A small `metrics` module records timestamps at the moments that matter, so a pilot can prove value:
- Alerts: detected_at, notified_at, acknowledged_at, false_positive flag -> time to notify, acknowledgement rate, false-positive rate.
- Grievances: created, assigned, closed, overdue -> median time to assign and close, overdue %.
- Follow-ups: % of department requests with owner, deadline and recorded outcome.
- Reports: time to generate; % of activities with evidence.
- Reliability: source-link accuracy, data freshness, failed-notification rate, availability (from the job worker's records).
Shown on an admin "Pilot metrics" page. Without this we cannot show a client results.

## 6. Order of work, restated by pillar
1. Foundations in parallel: UX shell S0 + backend W0 (job worker, migrations, http client, scope helper, registry, metrics events).
2. Intelligence engines (pillars 1 and 5 share them): gazetteer, tone/priority model with accuracy report, Postgres search.
3. Pillar 4 core (record engine, visitors, appointments, handover, delegation, approvals inbox).
4. Pillar 3 (grievances first, then projects evidence, emergency, funds, field app, map).
5. Pillar 2 after its data-source spike. 6. Optional AI plug-ins last.

## 7. Decisions needed
1. Use pillar names in the navigation (Today / Intelligence / Constituency / Office / Me + Assistant)?
2. Approve the Legislative data-source spike before any Legislative UI?
3. Approve the metrics layer as part of W0?
