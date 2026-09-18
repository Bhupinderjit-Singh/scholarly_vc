# Requirements Document

## Introduction

This spec delivers the calendar features of Scholarly (Phase 1): an in-app month, week, and agenda calendar of the Student's hosted and accepted sessions; a one-click "Add to Google Calendar" link; a per-session `.ics` download; and a personal iCal subscription feed that keeps Google Calendar (or any calendar app) in sync without OAuth scopes. It also prepares the data model for a future two-way Google Calendar API sync, which is deliberately deferred because Google requires app verification for calendar scopes on an app with open sign-up.

Steering files `.kiro/steering/product.md`, `tech.md`, and `structure.md` apply. The consolidated source of truth is `docs/REQUIREMENTS.md` (section F4); requirement IDs below match it.

## Glossary

| Term | Meaning |
|---|---|
| Web App | The browser-side Next.js UI. |
| API | The Next.js server: route handlers and server actions. |
| Database | Neon Postgres accessed through Drizzle ORM. |
| Calendar entry | A hosted or accepted session shown on the calendar. |
| Google template link | A `https://calendar.google.com/calendar/render?action=TEMPLATE` URL that pre-fills an event in the user's Google Calendar; no API access involved. |
| ICS | An RFC 5545 iCalendar file (`text/calendar`). |
| Feed | A per-user `.ics` URL protected by a secret token that calendar apps poll ("subscribe from URL"). |
| `webcal://` | The URL scheme calendar apps recognize for subscribing to a feed. |
| Session version | The `version` integer on a session, incremented on every reschedule; exported as `SEQUENCE`. |
| CalendarProvider | The single interface in `web/lib` through which link, file, and feed generation are implemented, so a Google API implementation can be added later. |

## Dependencies

- Spec 01 (`01-foundation-auth`): accounts, profile timezone, Settings sections.
- Spec 02 (`02-study-sessions`): sessions with status, `scheduled_start`, `scheduled_end`, `version`, invites, session detail page (the calendar actions slot in F2-R15).

## Requirements

### Requirement 1: Calendar views (ID: F4-R1)
**User Story:** As a Student, I want to see my study sessions on a calendar, so that I can plan my week.

#### Acceptance Criteria

1. WHEN a Student opens Calendar THEN THE Web App SHALL show a month view by default on viewports 1024 px and wider with a week-view toggle, and an agenda list grouped by day on narrower viewports.
2. THE Web App SHALL show sessions the Student hosts or has accepted, from 30 days in the past through every future scheduled date.
3. THE Web App SHALL color entries by status (`scheduled` lavender, `live` mint, `ended` neutral, `cancelled` and `expired` blush with strikethrough) and show a legend.
4. THE Web App SHALL mark today, allow navigating to previous and next periods and back to today, and support arrow-key navigation between days.
5. WHEN a Student selects an entry THEN THE Web App SHALL open a detail drawer with title, time in the Student's timezone, host, participant count, a Join or View action, and the actions of F4-R2 and F4-R3.
6. THE Web App SHALL load a month's entries within 1 s at p95.

### Requirement 2: Add to Google Calendar (ID: F4-R2)
**User Story:** As a Student, I want one click to put a session in my Google Calendar, so that it appears next to my other plans.

#### Acceptance Criteria

1. WHILE a session is `scheduled` THE Web App SHALL show an "Add to Google Calendar" button on the session detail page and in the calendar drawer.
2. WHEN the button is selected THEN THE Web App SHALL open `https://calendar.google.com/calendar/render?action=TEMPLATE` in a new tab with `text` = title, `dates` = start and end in UTC as `YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ`, `details` = description plus the session URL, and `location` = the session URL.
3. WHILE a session is `live`, `ended`, `cancelled`, or `expired` THE Web App SHALL hide the button.

### Requirement 3: ICS download (ID: F4-R3)
**User Story:** As a Student, I want to download a session as an `.ics` file, so that any calendar app can import it.

#### Acceptance Criteria

1. WHEN a Student selects "Download .ics" THEN THE API SHALL return an RFC 5545 `text/calendar` file for that session.
2. THE API SHALL set `UID` to `session-<id>@scholarly`, `SEQUENCE` to the session `version`, `DTSTAMP` to the generation time, `DTSTART` and `DTEND` in UTC, `SUMMARY` to the title, `DESCRIPTION` to the description plus the session URL, `URL` to the session URL, and `METHOD:PUBLISH`.
3. IF the session is `cancelled` or `expired` THEN THE API SHALL include `STATUS:CANCELLED`.
4. IF the requester is neither Host nor Invitee of the session THEN THE API SHALL respond with HTTP 404.
5. THE API SHALL generate ICS content through a pure function in `web/lib/domain` with unit tests that parse the output with an RFC 5545 parser.

### Requirement 4: Personal iCal feed (ID: F4-R4)
**User Story:** As a Student, I want a private calendar feed URL, so that Google Calendar shows all my sessions automatically.

#### Acceptance Criteria

1. WHEN a Student enables the calendar feed in Settings › Calendar THEN THE API SHALL create a feed token with at least 128 bits of randomness and show `NEXT_PUBLIC_APP_URL/api/calendar/feed/<token>.ics` and its `webcal://` form with a copy action.
2. WHEN the feed URL is requested THEN THE API SHALL return, authenticated only by the token, a `VCALENDAR` containing the user's hosted and accepted sessions from 30 days in the past through every future date, within 500 ms at p95.
3. WHEN a Student regenerates or revokes the feed token THEN THE API SHALL invalidate the previous URL immediately.
4. IF an unknown or revoked token is requested THEN THE API SHALL respond with HTTP 404 and an empty body.
5. THE Web App SHALL show instructions for subscribing in Google Calendar ("Other calendars › From URL") with the note that Google refreshes subscribed feeds roughly every 12 to 24 hours.
6. THE API SHALL include `X-WR-CALNAME:Scholarly` and `REFRESH-INTERVAL;VALUE=DURATION:PT1H` in the feed.

### Requirement 5: Future-sync readiness (ID: F4-R5)
**User Story:** As the owner, I want the data model ready for real Google Calendar sync, so that adding it later is additive.

#### Acceptance Criteria

1. THE Database SHALL include `calendar_event_links` (session_id, user_id, provider, external_event_id, last_synced_at) and `calendar_connections` (user_id, provider, encrypted credentials, created_at), unused by the UI in Phase 1.
2. THE API SHALL increment the session `version` on every reschedule so a future sync can detect changes.
3. THE Web App SHALL route all calendar link and file generation through a single `CalendarProvider` interface so a Google API implementation can be added without changing callers.

Upgrade path (informative): request the `calendar.events` scope incrementally from users who opt in, publish the OAuth app and pass Google verification (privacy policy, homepage, demo video), then create and update events in `calendar_event_links` on schedule, reschedule, and cancel.

### Requirement 6: Timezone correctness (ID: F4-R6)
**User Story:** As a Student, I want calendar times shown in my timezone, so that I never miss a session by an hour.

#### Acceptance Criteria

1. THE Web App SHALL display every calendar time in the Student's profile timezone and show the timezone name once per view.
2. WHEN a session spans a DST transition THEN THE Web App SHALL show the correct local start and end and the correct duration.
3. THE Web App SHALL include unit tests for month grids and agenda grouping across DST transitions and for a viewer whose timezone differs from the Host's.

## Non-Functional Acceptance Criteria

1. THE Web App SHALL keep the calendar route within the 200 KB gzipped JavaScript budget and load a month's entries within 1 s at p95.
2. THE API SHALL respond to feed requests within 500 ms at p95 and set `Content-Type: text/calendar; charset=utf-8` with `Cache-Control: private, max-age=300`.
3. THE Web App SHALL make the calendar keyboard-navigable (arrow keys between days, Enter to open an entry, Escape to close the drawer) and pass automated accessibility checks (axe) with zero serious or critical violations.
4. THE API SHALL compare feed tokens in constant time and never write them to logs.
5. THE API SHALL implement ICS, feed, and Google-link generation as pure functions in `web/lib/domain` with unit tests that parse the ICS output using an RFC 5545 parser and verify `UID`, `SEQUENCE`, `DTSTART`, `DTEND`, `STATUS`, and `METHOD`.
6. THE Web App SHALL include unit tests for month grid construction and agenda grouping across DST transitions and across a viewer timezone different from the Host's.

## Out of Scope

- Two-way Google Calendar API sync, Outlook or Apple Calendar API integrations (data model prepared; see F4-R5).
- Importing external calendars into Scholarly or showing free/busy information.
- Recurring sessions.
- Calendar sharing between Students beyond the sessions they are invited to.
