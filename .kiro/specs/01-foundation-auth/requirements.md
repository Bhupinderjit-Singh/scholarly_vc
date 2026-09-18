# Requirements Document

## Introduction

This spec delivers the foundation of Scholarly (Phase 1): the Next.js project skeleton with CI, the pastel design system and responsive app shell, and authentication with Google sign-in or email/username + password. It also covers email verification, password reset, rate limiting, profile and timezone settings, the registration flag, the Admin page, account deletion, and the static privacy and terms pages required by Google's OAuth consent screen. Everything later (sessions, dashboard, calendar, notifications, analysis) builds on this spec.

Steering files `.kiro/steering/product.md`, `tech.md`, and `structure.md` apply. The consolidated source of truth is `docs/REQUIREMENTS.md` (section F1); requirement IDs below match it.

## Glossary

| Term | Meaning |
|---|---|
| Web App | The browser-side Next.js UI, including its service worker. |
| API | The Next.js server: route handlers and server actions. |
| Database | Neon Postgres accessed through Drizzle ORM. |
| CI Pipeline | The GitHub Actions workflow that runs lint, typecheck, tests, and build. |
| Repository | This git repository. |
| Visitor | A person who is not signed in. |
| Student | Any signed-in user. |
| Admin | A Student whose email is listed in `ADMIN_EMAILS`. |
| Auth session | A Better Auth cookie session (distinct from a study session). |
| Identifier | The value typed into the sign-in form: an email address or a username. |
| Design tokens | The pastel colors, spacing, radius, shadow, and font defined in `tech.md`. |
| App shell | The persistent navigation and layout around every authenticated page. |

## Dependencies

None. This is the first spec and must be completed before any other.

## Requirements

### Requirement 1: Project scaffold and CI (ID: F1-R1)
**User Story:** As the owner, I want a production-grade project skeleton with CI, so that every later feature is built on a consistent, tested foundation.

#### Acceptance Criteria

1. THE Web App SHALL be a Next.js App Router project in `web/` written in TypeScript with `strict` enabled, using Tailwind CSS and shadcn/ui.
2. THE API SHALL access the Database only through Drizzle ORM, with migrations checked into `web/lib/db/migrations`.
3. WHEN the application starts with a missing or malformed required environment variable THEN THE API SHALL refuse to start and log the names (never the values) of the invalid variables.
4. WHEN `GET /api/health` is requested THEN THE API SHALL respond within 2 s with HTTP 200 and `{ "status": "ok", "db": "ok" }`, or HTTP 503 when the Database is unreachable.
5. THE CI Pipeline SHALL run lint, typecheck, unit tests, API tests, and a production build on every push and pull request.
6. THE CI Pipeline SHALL complete in under 10 minutes on GitHub-hosted runners.
7. THE Repository SHALL contain `web/.env.example` listing every environment variable from `tech.md` with placeholder values and no secrets.
8. THE Web App SHALL provide single npm scripts for lint, typecheck, unit tests (Vitest), API tests, e2e tests (Playwright), and build.

### Requirement 2: Design system and app shell (ID: F1-R2)
**User Story:** As a Student, I want a calm, fast, consistent interface on desktop and phone, so that using the app feels effortless.

#### Acceptance Criteria

1. THE Web App SHALL define the pastel design tokens from `tech.md` as CSS custom properties and map them into the Tailwind and shadcn/ui theme.
2. THE Web App SHALL render all text with a contrast ratio of at least 4.5:1 against its background.
3. WHILE the viewport is at least 1024 px wide THE Web App SHALL show a top navigation with Home, Sessions, Calendar, a notification bell, and a profile menu.
4. WHILE the viewport is narrower than 1024 px THE Web App SHALL show a bottom navigation with Home, Sessions, Calendar, and Profile, and keep the notification bell in the header.
5. WHEN a view is loading data THEN THE Web App SHALL display skeleton placeholders matching the final layout instead of spinners or blank areas.
6. IF the system preference `prefers-reduced-motion: reduce` is set THEN THE Web App SHALL disable non-essential transitions and animations.
7. THE Web App SHALL keep transition durations between 150 ms and 250 ms.
8. THE Web App SHALL show a visible focus indicator on every interactive element during keyboard navigation.
9. WHEN a list or view has no data THEN THE Web App SHALL show an empty state with a one-sentence explanation and that view's primary action.
10. THE Web App SHALL ship at most 200 KB of gzipped JavaScript on every route except the session room route.

### Requirement 3: Sign in with Google (ID: F1-R3)
**User Story:** As a Visitor, I want to sign in with my Google account, so that I can start without creating another password.

#### Acceptance Criteria

1. WHEN a Visitor selects "Continue with Google" THEN THE API SHALL start an OAuth 2.0 authorization-code flow requesting only the `openid`, `email`, and `profile` scopes.
2. WHEN Google returns a verified email that matches no existing account THEN THE API SHALL create an account with the Google name as display name, the Google picture as avatar, and a unique username derived from the email local part (lowercased, restricted to `[a-z0-9_]`, truncated to 20 characters, numeric suffix appended on collision).
3. WHEN Google returns a verified email that matches an existing account THEN THE API SHALL link the Google identity to that account and sign the user in.
4. IF Google reports the email as unverified THEN THE API SHALL reject the sign-in with "Your Google email address is not verified" and create no account.
5. IF the OAuth flow fails or is cancelled THEN THE Web App SHALL return the Visitor to the sign-in page with a non-technical message and no partial account.
6. WHEN sign-in completes THEN THE Web App SHALL redirect to the page originally requested, or to Home when none was requested.

### Requirement 4: Email or username with password (ID: F1-R4)
**User Story:** As a Visitor, I want to create an account with email, a username, and a password, so that I can use Scholarly without Google.

#### Acceptance Criteria

1. WHEN a Visitor submits the sign-up form THEN THE API SHALL require an email address, a username, a display name, and a password.
2. THE API SHALL accept a username only if it is 3 to 20 characters long, contains only `[a-z0-9_]` after lowercasing, and is unique case-insensitively.
3. THE API SHALL accept a password only if it is at least 10 characters long and absent from a bundled common-password denylist of at least 10,000 entries.
4. IF the username is already taken THEN THE API SHALL reject the sign-up with "That username is taken".
5. IF the email already belongs to an account THEN THE API SHALL respond exactly as for a successful sign-up, send that address an email explaining an account already exists, and create no duplicate.
6. WHEN sign-up succeeds THEN THE API SHALL create the account without starting a session, send the verification email (F1-R5), and show a "Check your email" page that also offers "Sign in now".
7. WHEN a Visitor submits the sign-in form THEN THE API SHALL accept either an email address or a username in the identifier field together with the password.
8. IF sign-in credentials are invalid THEN THE API SHALL respond with "Incorrect email/username or password" regardless of whether the identifier exists.
9. THE API SHALL hash passwords with Better Auth's default scrypt configuration and never store or log plaintext passwords.

### Requirement 5: Email verification (ID: F1-R5)
**User Story:** As a Student, I want to verify my email address, so that Scholarly can safely send me notifications.

#### Acceptance Criteria

1. WHEN an account is created with email and password THEN THE API SHALL send a verification email containing a single-use link valid for 24 hours.
2. WHEN a valid verification link is opened THEN THE API SHALL mark the email verified, sign the user in on that device, and show a confirmation page linking to Home.
3. IF a verification link is expired or already used THEN THE Web App SHALL show an explanation with a "Send a new link" action.
4. WHEN a new verification email is requested THEN THE API SHALL send it only if at least 60 s have passed since the previous one for that account.
5. WHILE the account email is unverified THE Web App SHALL show a dismissible banner on every app page with a "Resend" action, reappearing at the next sign-in.
6. WHILE the account email is unverified THE API SHALL suppress every email notification except verification and password-reset emails.
7. THE API SHALL treat emails obtained from Google sign-in as verified.

### Requirement 6: Password reset and change (ID: F1-R6)
**User Story:** As a Student, I want to reset a forgotten password and change my current one, so that I keep control of my account.

#### Acceptance Criteria

1. WHEN a Visitor submits the "Forgot password" form THEN THE API SHALL respond with "If an account exists for that email, we sent a reset link" regardless of whether the account exists.
2. IF the email belongs to an account THEN THE API SHALL send a single-use reset link valid for 1 hour.
3. WHEN a valid reset link is used with a password meeting F1-R4 rules THEN THE API SHALL update the password, invalidate every existing session of the account, and show the sign-in page with "Password updated. Sign in with your new password".
4. IF a reset link is expired or already used THEN THE Web App SHALL show an explanation and a link to request a new one.
5. WHEN a signed-in Student changes their password THEN THE API SHALL require the current password and, on success, invalidate every session except the current one.
6. IF the account has no password (Google only) THEN THE Web App SHALL offer "Set a password" through the reset-email flow instead of asking for a current password.

### Requirement 7: Rate limiting and anti-enumeration (ID: F1-R7)
**User Story:** As the owner, I want authentication endpoints protected against guessing and probing, so that accounts stay safe on a public sign-up app.

#### Acceptance Criteria

1. THE API SHALL limit sign-in, password-reset request, and verification-resend attempts to 5 per 15 minutes per combination of client IP and identifier.
2. WHEN a limit is exceeded THEN THE API SHALL respond with HTTP 429, a `Retry-After` or `X-Retry-After` header carrying the seconds to wait, and "Too many attempts. Try again in N minutes".
3. THE API SHALL return identical status codes and messages for existing and non-existing identifiers on sign-in and reset endpoints, with response times differing by no more than 100 ms.
4. THE API SHALL limit account creation to 10 per hour per client IP.

### Requirement 8: Profile and settings (ID: F1-R8)
**User Story:** As a Student, I want to manage my display name, username, avatar, and timezone, so that others recognize me and my times are shown correctly.

#### Acceptance Criteria

1. THE Web App SHALL provide Settings › Profile showing display name, username, avatar, email (read-only), and timezone.
2. WHEN a Student saves a display name THEN THE API SHALL accept 1 to 50 characters after trimming whitespace.
3. WHEN a Student saves a new username THEN THE API SHALL apply the F1-R4 username rules and reject it if taken.
4. THE Web App SHALL show the Google profile picture as avatar when available, otherwise the initials of the display name on a pastel background derived from the user id.
5. WHEN a Student signs in for the first time THEN THE Web App SHALL detect the browser's IANA timezone and store it as the profile timezone.
6. WHEN a Student edits the timezone THEN THE Web App SHALL offer the full IANA timezone list with search and save the selection.
7. IF the browser timezone differs from the stored timezone at sign-in THEN THE Web App SHALL show a one-time prompt offering to switch.
8. THE Web App SHALL structure Settings as sections (Profile, Study target, Notifications, Calendar, Focus analysis, Account) so later specs add sections without restructuring.

### Requirement 9: Sessions and sign-out (ID: F1-R9)
**User Story:** As a Student, I want to stay signed in on my devices and be able to sign out everywhere, so that access is convenient and controllable.

#### Acceptance Criteria

1. THE API SHALL issue the session cookie with `HttpOnly`, `Secure`, and `SameSite=Lax`.
2. THE API SHALL expire an auth session 30 days after its last use and extend the expiry on each request made at least 24 hours after the previous extension.
3. WHEN a Student selects "Sign out" THEN THE API SHALL invalidate the current auth session and redirect to sign-in.
4. WHEN a Student selects "Sign out everywhere" THEN THE API SHALL invalidate all auth sessions of the account including the current one.
5. WHEN a Visitor requests an authenticated route THEN THE Web App SHALL redirect to sign-in and return them to that route after successful sign-in.

### Requirement 10: Registration flag and admin (ID: F1-R10)
**User Story:** As the owner, I want to close sign-up and see usage at a glance, so that free tiers are protected.

#### Acceptance Criteria

1. WHILE `REGISTRATION_OPEN` is `false` THE API SHALL reject new sign-ups (email and Google) with "Scholarly is not accepting new accounts right now" and continue to sign in existing accounts.
2. WHILE `REGISTRATION_OPEN` is `false` THE Web App SHALL hide sign-up entry points and show the closed message on the sign-up page.
3. WHEN a Student whose email is listed in `ADMIN_EMAILS` opens the profile menu THEN THE Web App SHALL show an "Admin" entry.
4. THE Web App SHALL show on the Admin page the total user count, accounts created in the last 30 days, and the current month's usage counters against caps (video participant-minutes per user and global; analysis hours in Phase 2).
5. IF a non-admin requests the Admin page or its API THEN THE API SHALL respond with HTTP 404.

### Requirement 11: Account deletion (ID: F1-R11)
**User Story:** As a Student, I want to delete my account and data, so that I stay in control of my information.

#### Acceptance Criteria

1. WHEN a Student selects "Delete account" THEN THE Web App SHALL require typing their username before enabling the confirm button.
2. WHEN deletion is confirmed THEN THE API SHALL delete the user's profile, settings, auth sessions, invites, participations, camera reports and intervals, daily totals, notifications, push subscriptions, calendar tokens, recording metadata, and reports within 60 s.
3. WHEN deletion is confirmed THEN THE API SHALL cancel every `scheduled` session the user hosts, end any `live` session they host, and retain those session records with the host reference removed so other participants' history remains intact.
4. WHEN deletion cancels a scheduled session THEN THE API SHALL emit `session_cancelled` for each pending or accepted Invitee.
5. IF Phase 2 media exists for the user THEN THE API SHALL delete the Storage objects as part of the deletion.
6. WHEN deletion completes THEN THE API SHALL sign the user out and show a confirmation page.

### Requirement 12: Legal pages (ID: F1-R12)
**User Story:** As a Visitor, I want to read what data Scholarly handles, so that I can decide to use it (and Google's consent screen requires it).

#### Acceptance Criteria

1. THE Web App SHALL serve static `/privacy` and `/terms` pages accessible without sign-in.
2. THE Web App SHALL describe on `/privacy` the data collected (account, session participation, camera-on time), the third-party services used (Google sign-in, LiveKit, Neon, Vercel, Resend, Cloudflare R2, Modal), the Phase 2 recording behavior including deletion timelines, and how to delete an account.
3. THE Web App SHALL link `/privacy` and `/terms` from the sign-up page and the page footer.

## Non-Functional Acceptance Criteria

1. THE Web App SHALL achieve LCP ≤ 2.5 s, INP ≤ 200 ms, and CLS ≤ 0.1 on the sign-in, sign-up, Home shell, and Settings pages when measured with Lighthouse on a mid-range laptop profile over simulated 4G.
2. THE Web App SHALL pass automated accessibility checks (axe) with zero serious or critical violations on every page delivered by this spec.
3. THE API SHALL send the security headers `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy` (camera and microphone allowed for `self` only) on every response.
4. THE API SHALL log structured JSON with request id, user id, route, status, and duration for every request, and never log emails, names, passwords, tokens, or cookies.
5. THE CI Pipeline SHALL run Playwright e2e tests covering sign-up, sign-in with email and with username, password reset, sign-out, and the closed-registration state.
6. THE CI Pipeline SHALL run `npm audit` at high severity and fail on findings.

## Out of Scope

- Study sessions, video, invites (spec 02).
- Daily target, dashboard, history (spec 03).
- Calendar views and feeds (spec 04).
- Notification delivery beyond the auth emails needed here (spec 05).
- Focus analysis (spec 06).
- Phone-number or SMS login, avatar upload, dark mode, internationalization.
