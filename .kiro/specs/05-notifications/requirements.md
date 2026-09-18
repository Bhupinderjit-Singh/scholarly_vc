# Requirements Document

## Introduction

This spec delivers notifications for Scholarly (Phase 1) across three channels: in-app (bell, list, unread badge), email (Resend with React Email templates), and Web Push (VAPID, service worker, installable manifest). It defines the eleven notification types and their triggers, per-type per-channel preferences, the delivery log with retries, and the Scheduler endpoint `POST /api/cron/dispatch` that drives every time-based job in the system (reminders, session expiry, stale interval closing, reconciliation, and the Phase 2 sweeps). Earlier specs emit notifications through a single `notify()` function; this spec gives that function its channels.

Steering files `.kiro/steering/product.md`, `tech.md`, and `structure.md` apply. The consolidated source of truth is `docs/REQUIREMENTS.md` (section F5); requirement IDs below match it.

## Glossary

| Term | Meaning |
|---|---|
| Web App | The browser-side Next.js UI, including its service worker. |
| API | The Next.js server: route handlers and server actions. |
| Scheduler | The ordered, idempotent jobs executed by `POST /api/cron/dispatch`. |
| Worker | The Modal Python app; in this spec only its scheduled function that calls dispatch every 5 minutes. |
| Notification | One row in `notifications` for one recipient: type, payload (title, body, deep link, related ids), read state. |
| Channel | `inapp`, `email`, or `push`. |
| Fan-out | Evaluating a notification against the recipient's preferences and sending it on each enabled channel. |
| Delivery | One `notification_deliveries` row per notification per channel with a status. |
| Dispatch record | A `notification_dispatch` row (session, user, type) that prevents a scheduled notification from being sent twice. |
| Deep link | The in-app URL a notification opens (session detail, pre-join, focus report, Admin page). |
| VAPID | The key pair that identifies the app to browser push services. |
| Push subscription | A browser-issued endpoint plus keys for one device, stored in `push_subscriptions`. |
| Daily email quota | Resend's free-tier limit of 100 emails per day; the app reserves the last 10 for critical emails. |

## Dependencies

- Spec 01 (`01-foundation-auth`): accounts, verified emails, Settings sections, Admin page, verification and reset emails (which reuse this spec's email channel).
- Spec 02 (`02-study-sessions`): sessions, invites, `live` transition, participations (to know who is connected), usage caps, and the notification events it emits.
- Spec 03 (`03-dashboard-history`): the daily reconciliation job that the Scheduler runs.
- Spec 06 (`06-focus-analysis`) later adds the `analysis_ready`, `analysis_failed`, and `report_shared` triggers and the Scheduler's media sweep and re-trigger jobs; their types and job slots are defined here so no restructuring is needed.

## Requirements

### Requirement 1: Notification types and triggers (ID: F5-R1)
**User Story:** As a Student, I want to be told about invites, reminders, and reports, so that I never miss a session or a result.

| Type | Recipients | Trigger | Deep link |
|---|---|---|---|
| `invite_received` | Invitee | Host invites by identity | Session detail |
| `invite_accepted` | Host | Invitee accepts | Session detail |
| `invite_declined` | Host | Invitee declines | Session detail |
| `session_rescheduled` | Pending and accepted Invitees | Start or duration changes | Session detail |
| `session_cancelled` | Pending and accepted Invitees | Host cancels or account deletion cancels | Sessions list |
| `session_starting_soon` | Host and accepted Invitees | 10 minutes before `scheduled_start` | Session detail (pre-join) |
| `session_started` | Accepted Invitees not connected | Session becomes `live` | Session detail (pre-join) |
| `analysis_ready` | Report owner | Report stored and media deleted | Focus report |
| `analysis_failed` | Recording owner | Analysis failed after retries | Session detail |
| `report_shared` | Session participants | Owner shares a report | Focus report |
| `usage_cap_warning` | Admins | 80% and 100% of any cap | Admin page |

#### Acceptance Criteria

1. THE API SHALL support exactly the notification types in the table above.
2. WHEN a triggering event occurs THEN THE API SHALL create one notification per recipient through the single `notify(userId, type, payload)` function with a payload containing the related session or report id, a title, a body, and a deep link.
3. WHEN the Scheduler runs THEN THE Scheduler SHALL emit `session_starting_soon` to the Host and each accepted Invitee of every `scheduled` session whose `scheduled_start` is within the next 10 minutes, recording each send in `notification_dispatch` so it is emitted once per session and recipient.
4. WHEN a session transitions to `live` THEN THE API SHALL emit `session_started` to each accepted Invitee who is not connected to the room.
5. THE API SHALL emit `usage_cap_warning` only to Admins.

### Requirement 2: In-app notifications (ID: F5-R2)
**User Story:** As a Student, I want a notification bell in the app, so that I can catch up on what happened.

#### Acceptance Criteria

1. THE Web App SHALL show a bell icon in the header with an unread-count badge capped at "9+".
2. WHEN the bell is selected THEN THE Web App SHALL show the 20 most recent notifications with type icon, title, body, relative time, and unread indicator, plus "Load more" and "Mark all read".
3. WHEN a notification is selected THEN THE Web App SHALL mark it read and navigate to its deep link.
4. WHILE the app is open THE Web App SHALL poll for new notifications every 30 s and immediately when the window regains focus, announcing arrivals through an `aria-live="polite"` region.
5. WHEN the Scheduler runs THEN THE Scheduler SHALL delete notifications older than 90 days.
6. THE Web App SHALL provide a Notifications page with the same list paginated by 20.

### Requirement 3: Email (ID: F5-R3)
**User Story:** As a Student, I want important notifications by email, so that I see them even when the app is closed.

#### Acceptance Criteria

1. WHEN a notification is created for a type the user has email-enabled THEN THE API SHALL send an email through Resend using a React Email template for that type, only if the user's email is verified.
2. THE API SHALL send verification and password-reset emails through the same channel regardless of preferences.
3. THE API SHALL include in every notification email a footer link to notification preferences.
4. WHEN the day's send count (UTC) reaches 90 THEN THE API SHALL send only verification, password-reset, and `session_starting_soon` emails until 00:00 UTC, recording skipped sends as `skipped_quota`.
5. IF Resend returns an error THEN THE API SHALL record the failure for retry (F5-R7).
6. THE API SHALL send from `EMAIL_FROM` with the sender name "Scholarly".

### Requirement 4: Web Push (ID: F5-R4)
**User Story:** As a Student, I want push notifications for reminders, so that I join on time even with the app closed.

#### Acceptance Criteria

1. THE Web App SHALL register a service worker and serve a web manifest with name, short name, 192 px and 512 px icons, a theme color from the pastel palette, and `display: standalone`.
2. WHEN a Student completes a meaningful action (accepting an invite, creating a session, or enabling push in settings) and has not yet decided on push THEN THE Web App SHALL show an in-app explanation with an "Enable notifications" button before invoking the browser permission prompt, and never on first page load.
3. WHEN permission is granted THEN THE Web App SHALL subscribe with the VAPID public key and send the subscription (endpoint, keys, user agent) to `POST /api/push/subscribe`, stored as one row per device.
4. WHEN a push message is received THEN THE Web App SHALL display it through the service worker with the title, body, and app icon, and open or focus the deep link on click.
5. IF a push delivery returns HTTP 404 or 410 THEN THE API SHALL delete that subscription.
6. THE API SHALL include only the notification title, body, and deep link in push payloads.
7. THE Web App SHALL explain in Settings › Notifications that iPhone and iPad receive push only when Scholarly is added to the Home Screen (iOS 16.4 or later), with an "Add to Home Screen" hint.
8. WHEN a Student disables push for the current device THEN THE Web App SHALL unsubscribe in the browser and call `POST /api/push/unsubscribe`.
9. WHEN `POST /api/push/unsubscribe` is received THEN THE API SHALL delete the matching subscription row.

### Requirement 5: Preferences (ID: F5-R5)
**User Story:** As a Student, I want to choose which notifications reach me on which channel, so that I am informed without being spammed.

#### Acceptance Criteria

1. THE Web App SHALL show in Settings › Notifications a matrix of notification types (rows) by channels in-app, email, push (columns) with toggles.
2. THE API SHALL apply these defaults to new accounts: in-app on for all types; email on for `invite_received`, `invite_accepted`, `session_starting_soon`, `session_rescheduled`, `session_cancelled`, `analysis_ready`; push on for `session_starting_soon`, `session_started`, `analysis_ready`.
3. WHEN a toggle changes THEN THE Web App SHALL save optimistically and revert with a message if the save fails.
4. THE API SHALL evaluate preferences per channel at fan-out time.
5. THE API SHALL keep in-app delivery of `usage_cap_warning` always on for Admins.

### Requirement 6: Scheduler endpoint (ID: F5-R6)
**User Story:** As the owner, I want all time-based work driven by one protected endpoint, so that it runs reliably on free tiers.

#### Acceptance Criteria

1. THE API SHALL expose `POST /api/cron/dispatch` accepting only requests with `Authorization: Bearer <CRON_SECRET>` and responding HTTP 401 otherwise.
2. WHEN dispatch runs THEN THE Scheduler SHALL execute these idempotent jobs in order: send due `session_starting_soon`; expire sessions (F2-R4); close stale camera intervals (F2-R12); end sessions missing `room_finished` (F2-R4); re-trigger stuck analyses (F6-R5); delete overdue media (F6-R8); prune notifications older than 90 days; run the daily reconciliation once per UTC day (F3-R5); retry failed deliveries (F5-R7).
3. THE Scheduler SHALL complete a dispatch run within 60 s and return per-job counts in the JSON response and logs.
4. THE Scheduler SHALL produce the same end state whether dispatch is called once or several times within the same minute.
5. THE Worker SHALL call `POST /api/cron/dispatch` every 5 minutes through a Modal scheduled function.
6. THE API SHALL accept dispatch calls from any external caller presenting the secret (for example cron-job.org), as documented in `docs/DEPLOYMENT.md`.
7. IF a job fails THEN THE Scheduler SHALL log the error, continue with the remaining jobs, and return HTTP 200 with the failure listed.

### Requirement 7: Delivery log and retries (ID: F5-R7)
**User Story:** As the owner, I want to see whether notifications were delivered, so that I can debug missing reminders.

#### Acceptance Criteria

1. WHEN a notification is fanned out THEN THE API SHALL write one `notification_deliveries` row per channel with status `sent`, `failed`, `skipped_preference`, `skipped_unverified`, `skipped_quota`, or `skipped_no_subscription`, and the provider error when failed.
2. IF an email or push delivery fails THEN THE Scheduler SHALL retry it once at least 1 minute later and then mark it permanently `failed`.
3. THE Web App SHALL show Admins the last 24 hours of delivery counts by channel and status on the Admin page.

## Non-Functional Acceptance Criteria

1. THE API SHALL complete fan-out for one notification (in-app row plus email and push sends) within 2 s at p95, sending email and push after the HTTP response when triggered from a user request.
2. THE Scheduler SHALL complete a full dispatch run within 60 s and remain correct when invoked once per minute or once per hour.
3. THE API SHALL include only the title, body, and deep link in push payloads and never include email addresses, names of other users, or tokens.
4. THE Web App SHALL announce newly arrived in-app notifications through an `aria-live="polite"` region and make the bell, list, and preference matrix fully keyboard-operable.
5. THE API SHALL verify `CRON_SECRET` with a constant-time comparison and log dispatch runs with per-job counts and durations but never the secret.
6. THE Web App SHALL keep the service worker limited to push handling (no offline caching) and under 10 KB.
7. THE CI Pipeline SHALL run API tests for fan-out with each preference combination, the daily email quota rule, push subscription lifecycle (subscribe, 410 pruning, unsubscribe), dispatch idempotency, and `session_starting_soon` deduplication, and a Playwright e2e test for the preference matrix.

## Out of Scope

- SMS or messaging-app (WhatsApp, Telegram) delivery.
- Digest or summary emails, quiet hours, or snoozing.
- Native mobile push (APNs or FCM directly); iOS is covered only through installed web apps.
- Real-time in-app delivery via WebSockets or server-sent events (polling every 30 s is the requirement).
- Marketing or announcement emails.
