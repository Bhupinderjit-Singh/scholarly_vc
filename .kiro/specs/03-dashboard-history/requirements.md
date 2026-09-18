# Requirements Document

## Introduction

This spec delivers the study-time features of Scholarly (Phase 1): the daily target, the exact definition and computation of study time from camera-on intervals, the dashboard (today against target, last 7 or 30 days, weekly average, this week, streak, all-time), the history of past sessions, and the rollup tables that keep these views fast on a small database. It consumes the participations and camera intervals produced by spec 02.

Steering files `.kiro/steering/product.md`, `tech.md`, and `structure.md` apply. The consolidated source of truth is `docs/REQUIREMENTS.md` (section F3); requirement IDs below match it.

## Glossary

| Term | Meaning |
|---|---|
| Web App | The browser-side Next.js UI. |
| API | The Next.js server: route handlers and server actions. |
| Scheduler | The idempotent jobs executed by `POST /api/cron/dispatch` every 5 minutes (spec 05); this spec defines the daily reconciliation job. |
| CI Pipeline | The GitHub Actions workflow. |
| Camera interval | A period during which a Student's camera was on inside a webhook-confirmed participation (spec 02, F2-R12). |
| Study time | The sum of camera interval durations, counting overlaps once, attributed to local dates in the Student's timezone. |
| Local date | A calendar date in the Student's IANA timezone. |
| Daily target | Minutes of study time the Student aims for per local date; stored with `effective_from` history. |
| Applicable target | For a given local date, the target whose `effective_from` is the latest date on or before it. |
| Streak | Consecutive local days meeting the applicable target, ending today if today already meets it, otherwise ending yesterday. |
| Week | Monday to Sunday in the Student's timezone. |
| `daily_totals` | Rollup table with camera-on seconds and session count per Student per local date. |

## Dependencies

- Spec 01 (`01-foundation-auth`): accounts, profile timezone, Settings sections, app shell.
- Spec 02 (`02-study-sessions`): sessions, participations, camera reports and intervals, Home "Live now" and "Upcoming" components.

## Requirements

### Requirement 1: Daily target (ID: F3-R1)
**User Story:** As a Student, I want to set a daily study target, so that I have something concrete to hit every day.

#### Acceptance Criteria

1. THE Web App SHALL let a Student set a daily target between 15 minutes and 16 hours in 15-minute steps, in Settings › Study target and directly on the dashboard.
2. THE API SHALL default the daily target to 2 hours for new accounts.
3. WHEN a Student changes the target THEN THE API SHALL record it in `daily_target_history` with `effective_from` = today's date in the Student's timezone, replacing any earlier entry for that date.
4. WHEN a past day is evaluated THEN THE API SHALL compare that day's study time against the target whose `effective_from` is the latest date on or before that day.

### Requirement 2: Study-time computation (ID: F3-R2)
**User Story:** As a Student, I want my study time computed exactly and predictably, so that I trust the dashboard.

#### Acceptance Criteria

1. THE API SHALL compute study time as the sum of camera-on interval durations (F2-R12), counting overlapping seconds once.
2. WHEN a camera interval spans local midnight in the user's timezone THEN THE API SHALL split it at midnight and attribute each part to its local date.
3. WHILE a camera interval is open THE API SHALL count it up to the current time in today's total.
4. WHEN a user changes timezone THEN THE API SHALL keep previously recorded `local_date` values unchanged and use the new timezone for intervals that close after the change.
5. THE API SHALL implement study-time aggregation as pure functions in `web/lib/domain` with unit tests covering midnight splits, DST spring-forward and fall-back transitions, timezone change, open intervals, and overlapping intervals.

### Requirement 3: Dashboard widgets (ID: F3-R3)
**User Story:** As a Student, I want a dashboard of today, this week, and my streak, so that I can see progress at a glance.

#### Acceptance Criteria

1. WHEN a Student opens the dashboard THEN THE Web App SHALL show today's study time against today's target as a progress ring with percentage and remaining time.
2. THE Web App SHALL show a bar chart of study time per local day for the last 7 days (default) or last 30 days (toggle), with the applicable daily target drawn per day.
3. THE Web App SHALL show the weekly average (last 7 days total ÷ 7), this week's total (Monday to Sunday in the user's timezone), the current streak, the all-time total, and the number of sessions attended this week.
4. THE API SHALL compute the streak as the number of consecutive local days meeting or exceeding the applicable target, ending today when today already meets it and otherwise ending yesterday.
5. THE Web App SHALL embed the "Live now" and "Upcoming" sections from Home on the dashboard.
6. THE Web App SHALL render the dashboard with data within 1 s at p95 from a warm Database, showing skeletons while loading.
7. THE Web App SHALL provide a data-table alternative to the chart for screen readers.

### Requirement 4: History (ID: F3-R4)
**User Story:** As a Student, I want a record of every past session, so that I can look back at what I did.

#### Acceptance Criteria

1. THE Web App SHALL provide a History page listing past sessions the Student attended (at least one participation), newest first, paginated by 20.
2. THE Web App SHALL show for each entry the local date and start time, title, host, participant avatars, the Student's camera-on time, and the session duration (`ended_at − started_at`).
3. THE Web App SHALL provide a date-range filter with presets (last 7 days, last 30 days, this month, custom range).
4. WHEN a Student opens a history entry THEN THE Web App SHALL show the session detail with the Student's own camera-on time and participation times, and only presence (no camera-on time) for other participants.
5. IF the Student has no past sessions THEN THE Web App SHALL show an empty state with a "Start now" action.

### Requirement 5: Rollups (ID: F3-R5)
**User Story:** As the owner, I want aggregates precomputed, so that the dashboard stays fast on a tiny database.

#### Acceptance Criteria

1. WHEN a camera interval closes or a heartbeat extends an open interval THEN THE API SHALL update `daily_totals` (user, local date, camera-on seconds, sessions count) for the affected dates.
2. WHEN the Scheduler performs its daily reconciliation (first run after 03:00 UTC each day) THEN THE Scheduler SHALL recompute `daily_totals` for the last 3 days for every user with activity and correct any drift.
3. THE API SHALL serve dashboard and history aggregates from `daily_totals`, adding only today's open intervals from raw data.

### Requirement 6: End-to-end correctness (ID: F3-R6)
**User Story:** As the owner, I want the dashboard numbers verified automatically, so that regressions are caught before release.

#### Acceptance Criteria

1. THE CI Pipeline SHALL run an API test that seeds participations and camera reports across midnight and a DST transition and asserts the dashboard totals, weekly average, and streak to the second.
2. THE CI Pipeline SHALL run an API test asserting that overlapping intervals from a reconnection are counted once.

## Non-Functional Acceptance Criteria

1. THE Web App SHALL render the dashboard and history pages with data within 1 s at p95 from a warm Database, using skeleton loaders while pending.
2. THE Web App SHALL keep the dashboard and history routes within the 200 KB gzipped JavaScript budget, loading the chart library lazily.
3. THE Web App SHALL provide a data-table alternative for every chart and pass automated accessibility checks (axe) with zero serious or critical violations.
4. THE API SHALL implement study-time aggregation, applicable-target lookup, weekly average, and streak as pure functions in `web/lib/domain` with unit tests that pin the behavior for midnight splits, DST spring-forward and fall-back, timezone change, open intervals, and overlapping intervals.
5. THE API SHALL return only the requesting Student's camera-on time and never another Student's camera-on time in any response.
6. THE CI Pipeline SHALL run API tests that seed sessions, participations, and camera reports and assert the dashboard totals, weekly average, streak, and history entries to the second.

## Out of Scope

- Weekly or monthly targets, goals per subject, or Pomodoro timers.
- Manual time entry or a solo timer without a session.
- Data export (CSV or otherwise).
- Comparing study time with other Students (the Phase 2 leaderboard, spec 06, compares focus, not study time).
- Focus scores on the dashboard (added by spec 06).
