# Product: Scholarly

## What it is

Scholarly is a "study together" web app. A user starts or schedules a private video study session, invites friends, and everyone studies with their cameras on. Seeing other people study creates gentle accountability and makes long study blocks feel less lonely. The app measures camera-on study time against a daily target, keeps a history of sessions, shows upcoming sessions on a calendar, and sends reminders. In Phase 2 the app analyzes each user's own session recording and delivers a private focus report.

## Who it is for

- The owner and a circle of friends, about 10 people. Sign-up is open, but the product is designed and budgeted for a small group.
- Students and self-learners who study for long stretches and want company and honest numbers about how the time went.

## Roles

| Role | Meaning |
|---|---|
| Visitor | Not signed in. Can see the landing, sign-in, sign-up, privacy, and terms pages only. |
| Student | Any signed-in user. |
| Host | The Student who created a session. Controls invites, the invite link, editing, cancelling, removing participants, and ending the session. |
| Invitee | A Student invited to a session (by identity or via link). Can accept, decline, and join once accepted. |
| Admin | A Student whose email is listed in `ADMIN_EMAILS`. Sees usage counters and caps. No other special powers. |

## Product principles

1. **Simple and intuitive.** Every primary action (start now, schedule, invite, join) is one or two clicks from Home. No feature ships if it needs explaining.
2. **Fast and smooth.** Pages feel instant: server-rendered data, skeleton loaders, optimistic updates, small JavaScript bundles, the video client loaded only on the room route. Concrete budgets live in `tech.md`.
3. **Calm pastel identity.** Soft pastel surfaces, dark ink text with proper contrast, rounded corners, subtle motion that respects reduced-motion preferences. One light theme.
4. **Privacy first.** Only a user's own camera (and mic, only with a separate opt-in) is ever recorded, at low resolution, and the media is permanently deleted once the report exists. Other participants are never recorded. Reports are private unless the user shares them.
5. **USD 0 infrastructure.** Every service runs on a free tier. Caps and flags exist so a stranger cannot spend the owner's money. Anything that would cost money is a config change, never a code change.
6. **Incremental delivery.** Six ordered specs, each shippable and demoable on its own. No big jumps in complexity.

## Scope

### Phase 1
- Sign in with Google; sign up with email/username + password.
- Instant and scheduled private study sessions with video and (muted by default) audio, up to 10 participants.
- Invites by username/email and by revocable private link. Only the host and accepted invitees can join.
- Camera-on study-time tracking, daily target, dashboard (today, last 7 days, weekly average, streak), and full session history.
- In-app calendar, "Add to Google Calendar" link, `.ics` download, personal iCal subscription feed.
- Notifications in-app, by email, and by Web Push, with per-type preferences.

### Phase 2
- Opt-in focus analysis: local low-resolution recording of the user's own camera (and optionally mic), chunked upload, offline analysis, private report (presence, attention, phone use, drowsiness, talking/noise, focus score, deep-work blocks), permanent deletion of the media after the report is delivered.
- Optional sharing of a report with the session's participants and an opt-in weekly friends leaderboard.

### Non-goals (all phases unless stated)
- Text chat and screen sharing (Phase 1 explicitly excludes them).
- Recording other participants, or any provider-side cloud recording.
- Native mobile apps. The web app is desktop-first and mobile-friendly; it can be installed to the Home Screen for push notifications.
- Payments, subscriptions, or any monetization.
- Internationalization; English only.
- Dark mode in Phase 1.
- Phone-number or SMS login.
- Full two-way Google Calendar API sync in Phase 1 (the data model is ready for it; see spec 04).

## Glossary

| Term | Definition |
|---|---|
| Session | A private video meeting for studying, owned by a Host. Has a lifecycle: `scheduled`, `live`, `ended`, `cancelled`, `expired`. |
| Instant session | A session created with "Start now"; it is `live` immediately. |
| Scheduled session | A session with a planned start time and duration; joinable from 10 minutes before the start. |
| Host | The user who created the session. |
| Invitee | A user invited to a session, by identity (username or email) or via the invite link. |
| Invite link | A per-session URL containing a secret token. The host can enable, disable, or regenerate it. |
| Participation | One continuous presence of a user in a session's room, from join to leave, confirmed by the video server's webhooks. A user can have several participations in one session. |
| Camera-on time | Seconds during a participation in which the user's camera was on. This is the only time that counts as study time. |
| Study time | Sum of camera-on time, attributed to calendar days in the user's timezone. |
| Daily target | The number of study hours a user aims for each day. Kept with history so past days compare against the target that applied then. |
| Streak | Number of consecutive days, ending today or yesterday, on which study time met the daily target. |
| Focus report | The Phase 2 analysis result for one user in one session: metrics, episodes, and a per-minute timeline. |
| Deep-work block | A continuous run of focused time of at least N minutes (default 25, user-configurable) that tolerates interruptions of 30 seconds or less. |
| Distraction episode | A contiguous period in which the user was looking away, using a phone, talking, drowsy, or in a noisy environment. |
| Away episode | A contiguous period of at least 10 seconds with no face detected. |
| Cap | An environment-configured monthly limit (video minutes, analysis hours) per user and globally, used to protect free tiers. |
