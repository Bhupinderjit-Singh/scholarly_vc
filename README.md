# Scholarly

Scholarly is a "study together" web app. You start or schedule a private video study session, invite friends by name or with a private link, and study with your cameras on so nobody feels alone at the desk. The app counts camera-on study time against a daily target, keeps a history of sessions, shows upcoming sessions on a calendar (with Google Calendar links, `.ics` files, and a subscription feed), and sends reminders in-app, by email, and by push. In Phase 2 it analyzes your own low-resolution session recording into a private focus report (presence, attention, phone use, drowsiness, talking, deep-work blocks) and then permanently deletes the recording. Other participants are never recorded.

Built for the owner and about ten friends, on free tiers, with a target infrastructure cost of USD 0 per month.

**Status:** requirements phase. No application code yet. The original one-page brief is in `Description.md`.

## Repository layout

```
Description.md                         Original brief (unchanged)
docs/REQUIREMENTS.md                   Consolidated requirements: source of truth (F1–F6, NFRs, data model, risks, traceability)
.kiro/steering/product.md              Product intent, roles, principles, scope, glossary
.kiro/steering/tech.md                 Stack, verified free-tier limits, hard rules, env vars, quality bars, design tokens
.kiro/steering/structure.md            Monorepo layout (web/, worker/), naming, git conventions
.kiro/specs/01-foundation-auth/        Project scaffold, design system, Google + email/username auth, profile, admin, legal pages
.kiro/specs/02-study-sessions/         Instant and scheduled sessions, invites, invite link, LiveKit room, presence and camera-on tracking, caps
.kiro/specs/03-dashboard-history/      Daily target, study-time computation, dashboard, history, rollups
.kiro/specs/04-calendar/               Calendar views, Google Calendar link, .ics, personal iCal feed, future-sync readiness
.kiro/specs/05-notifications/          In-app, email, Web Push, preferences, delivery log, Scheduler endpoint
.kiro/specs/06-focus-analysis/         Phase 2: opt-in local recording, upload, Modal analysis worker, deletion, report, sharing, leaderboard
```

Each spec folder contains `requirements.md` in Kiro's user-story + EARS acceptance-criteria format. The criteria are identical to section 5 of `docs/REQUIREMENTS.md` and share its requirement IDs (`F<spec>-R<n>`), so anything can be traced in both directions (see the traceability table in section 11).

## Using these specs in Kiro

1. Open this folder in Kiro. The steering files in `.kiro/steering/` apply automatically to every session.
2. Start a Spec session on `.kiro/specs/01-foundation-auth`. Review `requirements.md`, then let Kiro generate `design.md` and `tasks.md`. Review both before executing tasks; the design must follow `tech.md` (stack, hard rules, budgets).
3. Execute the tasks. Each spec ends in a demoable increment; build and test before every commit.
4. Repeat for `02` through `06`, in order. Each spec's Dependencies section names what must already exist. `06-focus-analysis` is Phase 2 and can wait until Phase 1 has been used for a while.
5. When a requirement changes, edit `docs/REQUIREMENTS.md` first, then the matching spec, and keep the criteria identical.

Before the first deployment you will need accounts on Vercel, Neon, LiveKit Cloud, Resend, and (for Phase 2) Cloudflare R2 and Modal, plus a Google Cloud OAuth client. Spec 01 produces `web/.env.example` listing every variable; the planned `docs/DEPLOYMENT.md` will walk through the setup.

## Cost model

Everything runs on free tiers (limits verified during planning; see `.kiro/steering/tech.md`):

| Service | Free tier used | Guardrail |
|---|---|---|
| Vercel Hobby | Hosting and API functions | Uploads bypass functions; no sub-daily cron |
| Neon | 0.5 GB Postgres | Rollup tables, 90-day notification retention |
| LiveKit Cloud | 5,000 participant-minutes/month, hard cap | Per-user and global monthly caps with Admin warnings; self-host LiveKit on an Oracle Cloud always-free VM by changing `LIVEKIT_URL` if minutes run out |
| Resend | 100 emails/day | Auth and "starting soon" emails prioritized near the limit |
| Cloudflare R2 (Phase 2) | 10 GB, free egress | Recordings deleted within 60 s of the report; 2-day lifecycle rule |
| Modal (Phase 2) | USD 30/month compute credit | Analysis hour caps; about USD 0.05 per 2-hour recording |

Registration can be closed at any time with `REGISTRATION_OPEN=false`.

## Pushing this repository

The repository is initialized on `main` with `origin` set to `https://github.com/Bhupinderjit-Singh/scholarly_vc.git`. Nothing has been pushed yet. To publish:

```bash
git push -u origin main
```
