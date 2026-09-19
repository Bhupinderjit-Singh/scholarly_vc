# Design Document

## Overview

This design implements spec `01-foundation-auth` (requirements F1-R1 to F1-R12): the Next.js project skeleton with CI, the pastel design system and responsive app shell, and authentication with Google or email/username + password, including verification, password reset, rate limiting, profile and timezone settings, the registration flag, the Admin page, account deletion, and the static legal pages.

The guiding decision is to let Better Auth own every authentication endpoint and to express Scholarly's policies (password denylist, per-identifier rate limits, timing floor, registration flag, username derivation, deletion cascades) as Better Auth hooks and configuration. Every entry point (the React client, a raw HTTP call, a server action) then passes through the same policy code once. The browser talks to Better Auth through its React client; server components and server actions read the session through `auth.api.getSession`.

Verified against Better Auth 1.7.x documentation during design: `username` plugin options (`minUsernameLength`, `maxUsernameLength`, `usernameValidator`, `validationOrder`), `emailAndPassword` options (`autoSignIn`, `minPasswordLength`, `revokeSessionsOnPasswordReset`, `sendResetPassword`), `emailVerification` options (`sendVerificationEmail`, `autoSignInAfterVerification`, `expiresIn`), `rateLimit` (`storage: "database"`, `customRules`, `X-Retry-After`), `session` (`expiresIn`, `updateAge`, `freshAge`, `cookieCache`), `user.validateUserInfo`, `user.deleteUser` (`beforeDelete`, `afterDelete`), `databaseHooks.user.create.before`, `hooks.before/after` with `createAuthMiddleware` and `APIError`, `disabledPaths`, and the Next.js integration (`toNextJsHandler`, `nextCookies`, `proxy.ts` in Next.js 16, `getSessionCookie`). Current stable versions at design time: Next.js 16.3, Better Auth 1.7.5, Tailwind CSS 4.3, drizzle-orm 0.45.

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI[Server-rendered pages<br/>+ small client islands]
    AC[authClient<br/>better-auth/react + usernameClient]
  end
  subgraph Vercel["Vercel (web/)"]
    PX[proxy.ts<br/>nonce CSP, optimistic auth redirect, request id]
    RSC[Server components<br/>requireUser / requireAdmin]
    SA[Server actions<br/>settings, timezone, delete account]
    BA["/api/auth/[...all]<br/>Better Auth handler + hooks"]
    H[/api/health]
  end
  DB[(Neon Postgres<br/>pg Pool + Drizzle)]
  G[Google OAuth]
  M[Resend]
  UI --> PX --> RSC
  UI --> SA --> DB
  AC --> BA --> DB
  BA <--> G
  BA -. fire-and-forget .-> M
  RSC --> DB
  H --> DB
```

### Request flows

**Sign-up (email/username + password).** `authClient.signUp.email({ email, password, name, username })` → Better Auth `/sign-up/email` → `hooks.before`: per-IP+identifier limit, password denylist, if the email already exists send the "account exists" email in the background → Better Auth creates the user with `autoSignIn: false` (no cookie), or returns the synthetic 200 for an existing email → `databaseHooks.user.create.after` inserts `user_settings` → `emailVerification.sendVerificationEmail` sends the link in the background → UI shows `/check-email`.

**Sign-in.** UI splits the identifier: contains `@` → `authClient.signIn.email`, otherwise `authClient.signIn.username`. `hooks.before` applies the per-identifier limit; `hooks.after` pads the response to the 350 ms floor. Cookie set by Better Auth; UI navigates to `next` or Home.

**Google sign-in.** `authClient.signIn.social({ provider: "google", callbackURL })` → Google → `/api/auth/callback/google` → `user.validateUserInfo` rejects unverified emails and closed registration → account linking by verified email → `databaseHooks.user.create.before` derives a username for new users → cookie → redirect.

**Verification.** Link from the email opens `/api/auth/verify-email?token=…&callbackURL=/verified`; Better Auth marks the email verified and, with `autoSignInAfterVerification: true`, sets the session cookie, then redirects to `/verified` (or to `/verify-email?error=…`).

**Password reset.** `/forgot-password` → `authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })` (same generic response for any email) → email link → `/reset-password?token=…` → `authClient.resetPassword({ newPassword, token })` → with `revokeSessionsOnPasswordReset: true` all sessions are revoked → UI navigates to `/sign-in?reset=1`.

**Protected page.** `proxy.ts` sees no session cookie → redirects to `/sign-in?next=<path>`. Pages under `(app)` call `requireUser()`, which validates the session against the database and redirects if invalid.

**Account deletion.** Settings › Account → user types their username → server action verifies the typed value, requires a fresh session (created within 15 minutes; otherwise returns `needsReauth`) → `auth.api.deleteUser({ headers })` → `beforeDelete` runs the deletion-handler registry → Better Auth deletes the user; `ON DELETE CASCADE` removes dependent rows → redirect to `/goodbye`.

### Route map (`web/app`)

| Route | Kind | Notes |
|---|---|---|
| `(auth)/sign-in`, `(auth)/sign-up`, `(auth)/check-email`, `(auth)/forgot-password`, `(auth)/reset-password`, `(auth)/verify-email`, `(auth)/verified`, `(auth)/goodbye` | Server pages with client form islands | No app shell; `?error=` and `?reset=1` mapped to messages |
| `(app)/page.tsx` | Server page | Home shell with empty states; spec 02 fills content |
| `(app)/settings/profile`, `(app)/settings/account` | Server pages + server actions | Sections for later specs are registered in `settings/sections.ts` |
| `(app)/admin` | Server page | `requireAdmin()`; `notFound()` for non-admins |
| `privacy`, `terms` | Static server pages | Linked from sign-up and footer |
| `api/auth/[...all]` | Route handler | `toNextJsHandler(auth)` |
| `api/health` | Route handler | DB round-trip with 2 s timeout |
| `api/test/outbox` | Route handler | Only when `E2E_TEST_MODE=true`; returns captured emails |

## Components and Interfaces

### `web/lib/env.ts`
Zod schema for server environment (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAILS` default `""`, `REGISTRATION_OPEN` default `"true"` coerced to boolean, `NEXT_PUBLIC_APP_URL`, optional `EMAIL_TRANSPORT` in `resend | capture`, optional `E2E_TEST_MODE`). Variables owned by later specs (`LIVEKIT_*`, `R2_*`, `VAPID_*`, `CRON_SECRET`, `WORKER_*`, caps) are declared optional now and tightened by those specs. `instrumentation.ts` imports this module in `register()` so the server refuses to start on invalid configuration and logs only the offending variable names (F1-R1.3). `.env.example` lists every variable from `tech.md` with placeholders.

### `web/lib/db`
- `client.ts`: `pg.Pool({ connectionString, max: 5, ssl })` wrapped by `drizzle(pool, { schema })`. The `pg` driver works identically against Neon's pooled connection string in production, a Neon branch in development and local tests, and the Postgres service container in CI, which is why it is preferred over the Neon HTTP driver.
- Environments: production uses the Neon `main` branch; local development uses a Neon `dev` branch (`DATABASE_URL`); local API tests use a Neon `test` branch (`DATABASE_URL_TEST`); CI uses a Postgres 16 service container. No database software is installed on the developer machine.
- `schema/auth.ts`: Better Auth core tables (`user`, `session`, `account`, `verification`, `rate_limit`) plus the username plugin fields (`username`, `display_username`), generated with `npx @better-auth/cli generate` and committed. `schema/settings.ts`: `user_settings`, `auth_attempts`, `email_outbox`. `schema/index.ts` re-exports.
- `migrations/`: generated by `drizzle-kit generate`, applied by `drizzle-kit migrate` (`npm run db:migrate`). Migrations run from CI on pushes to `main` (job `migrate`, secret `DATABASE_URL`) before Vercel deploys; the Vercel build never migrates.

### `web/lib/auth/auth.ts` (Better Auth server instance)
```ts
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,                     // enumeration-safe sign-up (F1-R4.5, F1-R4.6)
    minPasswordLength: 10,
    revokeSessionsOnPasswordReset: true,   // F1-R6.3
    sendResetPassword: ({ user, url }) => sendInBackground(resetPasswordEmail(user, url)),
  },
  emailVerification: {
    sendOnSignUp: true,
    expiresIn: 60 * 60 * 24,               // F1-R5.1
    autoSignInAfterVerification: true,     // F1-R5.2
    sendVerificationEmail: ({ user, url }) => sendInBackground(verifyEmail(user, url)),
  },
  socialProviders: { google: { clientId, clientSecret, prompt: "select_account" } },
  account: { accountLinking: { enabled: true } },   // Google's verified email links to an existing account (F1-R3.3)
  user: {
    validateUserInfo: validateUserInfo,      // unverified Google email, registration closed (F1-R3.4, F1-R10.1)
    deleteUser: { enabled: true, beforeDelete: runDeletionHandlers, afterDelete: logDeletion },
  },
  databaseHooks: {
    user: {
      create: {
        before: ensureUsername,              // derive username for Google sign-ups (F1-R3.2)
        after: createDefaultSettings,        // user_settings row
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,          // F1-R9.2
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 15,                     // deletion requires a session created within 15 min
    cookieCache: { enabled: true, maxAge: 60 },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60, max: 100,
    customRules: {
      "/sign-in/email": { window: 900, max: 5 },
      "/sign-in/username": { window: 900, max: 5 },
      "/request-password-reset": { window: 900, max: 5 },
      "/send-verification-email": { window: 900, max: 5 },
      "/sign-up/email": { window: 3600, max: 10 },
      "/get-session": false,
    },
  },
  advanced: { ipAddress: { ipAddressHeaders: ["x-real-ip"] } },   // Vercel sets x-real-ip; confirm at deploy
  disabledPaths: ["/is-username-available"],
  hooks: { before: beforeHook, after: afterHook },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 20,
      usernameValidator: (u) => /^[a-z0-9_]+$/.test(u),
      validationOrder: { username: "post-normalization" },
    }),
    nextCookies(),                          // must stay last
  ],
});
```
Exact endpoint path strings (for example `/request-password-reset`) are confirmed against the installed version during implementation; the policy module keys on a small `AUTH_PATHS` constant so a rename touches one file.

### `web/lib/auth/policy.ts` (hooks)
- `beforeHook = createAuthMiddleware(async (ctx) => { … })`:
  - records `performance.now()` in a `WeakMap<Request, number>` keyed by `ctx.request` for the padded paths;
  - for sign-in, reset-request, and resend paths: `consumeIdentifierLimit({ scope, ip, identifier })` and throw `APIError("TOO_MANY_REQUESTS", { message: "Too many attempts. Try again in N minutes" })` with a `Retry-After` header when exceeded (F1-R7.1, F1-R7.2);
  - for `/send-verification-email`: 60-second cooldown per account (F1-R5.4);
  - for `/sign-up/email`, `/reset-password`, `/change-password`, `/set-password`: `assertAcceptablePassword(ctx.body.password ?? ctx.body.newPassword)` (F1-R4.3);
  - for `/sign-up/email`: if a user with that email exists, `sendInBackground(accountExistsEmail(user))` and let Better Auth return its synthetic response (F1-R4.5).
- `afterHook`: for padded paths, await until 350 ms have elapsed since the recorded start, so existing and non-existing identifiers respond in the same time (F1-R7.3).

### `web/lib/auth/password-policy.ts`
Loads `common-passwords.txt` (10,000 entries, lowercase, permissive license noted in the file header) into a `Set` once. `isAcceptablePassword(pw): { ok: true } | { ok: false, reason: "too_short" | "too_common" }`.

### `web/lib/auth/identifier-limit.ts`
Fixed-window counter in `auth_attempts` keyed by `sha256(scope | ip | normalizedIdentifier)`. One atomic statement: `INSERT … ON CONFLICT (key) DO UPDATE SET count = CASE WHEN auth_attempts.window_start < now() - $window THEN 1 ELSE auth_attempts.count + 1 END, window_start = CASE WHEN … THEN now() ELSE auth_attempts.window_start END RETURNING count, window_start`. Returns `{ allowed, retryAfterSeconds }`. Pure helper `computeRetryAfter(windowStart, windowSeconds, now)` lives in `lib/domain/rate-limit.ts` with unit tests.

### `web/lib/auth/username.ts`
`deriveUsername(email)`: local part → lowercase → replace disallowed characters with `_` → collapse repeats → trim to 20 → pad to 3 with `user`. `ensureUsername(user)`: if `username` is missing, derive it and append `2`, `3`, … until unique (F1-R3.2). Pure derivation function in `lib/domain/username.ts` with unit tests.

### `web/lib/auth/validate-user-info.ts`
```ts
export const validateUserInfo: ValidateUserInfo = ({ user, source }) => {
  if (source.action === "create-user" && !env.REGISTRATION_OPEN)
    return { error: "registration_closed", errorDescription: "Scholarly is not accepting new accounts right now" };
  if (source.oauth?.providerId === "google" && source.oauth.profile?.email_verified === false)
    return { error: "email_not_verified", errorDescription: "Your Google email address is not verified" };
};
```
OAuth redirect flows land on `/sign-in?error=<code>`; the sign-in page maps codes to messages.

### `web/lib/auth/deletion.ts`
`registerDeletionHandler(name, fn)` and `runDeletionHandlers(user)`. Spec 01 registers `deleteStorageObjectsPlaceholder` (no-op) and relies on `ON DELETE CASCADE` for its own tables; specs 02–06 register cancelling hosted sessions, removing media, and so on (F1-R11.2–F1-R11.5).

### `web/lib/auth/guards.ts`
`getSession()` (cached per request with `React.cache`), `requireUser(next?)` → redirects to `/sign-in?next=`, `requireAdmin()` → `notFound()` unless `isAdmin(session.user.email)`, `isAdmin(email)` parses `ADMIN_EMAILS` (lowercased, trimmed).

### `web/lib/auth/client.ts`
`createAuthClient({ plugins: [usernameClient()] })` from `better-auth/react`, with a global `fetchOptions.onError` that turns 429 into a toast using `X-Retry-After`.

### `web/lib/email`
- `transport.ts`: `interface EmailTransport { send(msg: { to: string; subject: string; react: ReactElement; text: string }): Promise<void> }`; `ResendTransport` (from `EMAIL_FROM`, sender name "Scholarly"); `CaptureTransport` writes rows to `email_outbox` and is selected only when `EMAIL_TRANSPORT=capture` and `E2E_TEST_MODE=true`.
- `send.ts`: `sendInBackground(msg)` uses `after()` from `next/server` (or `ctx.context.runInBackground` inside hooks) so email latency never leaks into auth responses; failures are logged with the recipient user id, never the address.
- Templates in `web/emails/`: `verify-email.tsx`, `reset-password.tsx`, `account-exists.tsx` (React Email; pastel header, plain-text alternative).

### `web/proxy.ts`
Runs on every non-static request: generates a CSP nonce, sets `Content-Security-Policy` (`default-src 'self'; script-src 'self' 'nonce-<n>' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://lh3.googleusercontent.com; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; form-action 'self' https://accounts.google.com; base-uri 'self'`), forwards the nonce in `x-nonce`, adds `x-request-id`, and for `(app)` paths redirects to `/sign-in?next=` when `getSessionCookie(request)` is absent (optimistic; pages still call `requireUser`). Static headers (HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy: camera=(self), microphone=(self), geolocation=()`) are set in `next.config.ts` `headers()`. Spec 02 extends `connect-src` and `media-src` for LiveKit.

### Design system (`web/app/globals.css`, `components/ui`, `components/shell`)
- Tailwind v4 CSS-first theme: `@theme { --color-lavender … --color-line; --color-ink; --color-ink-muted; --color-paper; --font-sans: var(--font-inter); --radius-xl: 1rem; --shadow-soft: 0 4px 16px rgb(31 41 51 / 0.06); }`.
- shadcn/ui semantic variables mapped to tokens: `--background: paper`, `--foreground: ink`, `--card: #FFFFFF`, `--primary: ink`, `--primary-foreground: paper`, `--secondary: lavender`, `--secondary-foreground: ink`, `--accent: sky`, `--muted: #F1EFF9`, `--muted-foreground: ink-muted`, `--destructive: #9F1D35` (on blush surfaces), `--border: line`, `--ring: ink`. Rule: text is always ink or ink-muted; pastels are surfaces. A unit test computes WCAG contrast for every text/surface pair in use and fails below 4.5:1 (F1-R2.2).
- Components installed from shadcn: button, input, label, card, dialog, dropdown-menu, avatar, badge, skeleton, sonner, tabs, switch, command (timezone search), tooltip, sheet, separator, alert.
- `components/shell`: `top-nav.tsx` (`hidden lg:flex`), `bottom-nav.tsx` (`lg:hidden`, fixed bottom), `notification-bell.tsx` (placeholder button; spec 05 wires it), `profile-menu.tsx` (Settings, Admin when `isAdmin`, Sign out), `unverified-banner.tsx` (dismiss stored in `sessionStorage`), `page-header.tsx`, `empty-state.tsx`, `app-footer.tsx` (privacy, terms).
- Motion and focus: `@media (prefers-reduced-motion: reduce)` neutralizes animations; transitions use `duration-150`–`duration-200`; global `:focus-visible` ring in ink.
- Fonts: Inter variable via `next/font/google` exposed as `--font-inter`.
- Skeletons: `loading.tsx` in every route segment with a layout-matching skeleton (F1-R2.5).
- Budget: `scripts/check-bundle-budget.mjs` sums gzipped chunk sizes per route from `.next/app-build-manifest.json` and fails the build job if any route except `/sessions/[id]/room` exceeds 200 KB (F1-R2.10).

### Settings and profile (`(app)/settings`)
- `sections.ts`: ordered registry `[profile, studyTarget, notifications, calendar, focusAnalysis, account]`; unimplemented sections render a "Coming soon" card so later specs only add a component (F1-R8.8).
- `profile/page.tsx` + `profile-form.tsx`: display name (Zod 1–50 after trim), username (client `authClient.updateUser({ username })`, server error "That username is taken"), avatar (Google `image` or `InitialsAvatar` with a hue derived from `hash(userId) % 360` on a pastel background), email read-only, timezone `Combobox` over `Intl.supportedValuesOf("timeZone")`.
- `timezone-sync.tsx` (client, mounted in `(app)/layout.tsx`): on first authenticated load with `timezone` null, calls `setTimezoneAction(browserTz)`; when stored and browser zones differ, shows a one-time toast per browser session offering to switch (F1-R8.5–F1-R8.7).
- `account/page.tsx`: change password (`authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })`) or "Set a password" for Google-only accounts (starts the reset-email flow), "Sign out everywhere" (`authClient.revokeSessions()` then `signOut()`), and "Delete account" (typed username, fresh-session check, `deleteAccountAction`).

### Admin (`(app)/admin`)
Server page guarded by `requireAdmin()`. `UserStats` (total users, created in last 30 days) from Drizzle counts. `UsageStats` is an extension slot that renders "Usage counters appear once sessions exist" until spec 02 provides `usage_counters` (F1-R10.4). Non-admins receive `notFound()` (F1-R10.5).

### Health (`api/health/route.ts`)
`SELECT 1` through the pool with `AbortSignal.timeout(2000)`; `200 { status: "ok", db: "ok" }` or `503 { status: "degraded", db: "unreachable" }` (F1-R1.4).

### Logging (`web/lib/log.ts`)
`log.info|warn|error(event, fields)` emits one JSON line with `requestId` (from `x-request-id`), `userId`, `route`, `status`, `durationMs`. A `redact` helper strips `email`, `name`, `password`, `token`, `cookie` keys; the auth hooks log only user ids and path names.

## Data Models

Better Auth tables (names as generated; the Drizzle adapter maps camelCase fields to these columns):

| Table | Columns |
|---|---|
| `user` | id (text PK), name, email (unique), email_verified (bool), image, username (unique, lowercase), display_username, created_at, updated_at |
| `session` | id, token (unique), user_id (FK user, cascade), expires_at, ip_address, user_agent, created_at, updated_at |
| `account` | id, user_id (FK user, cascade), account_id, provider_id (`credential` or `google`), access_token, refresh_token, id_token, scope, password (scrypt hash for `credential`), created_at, updated_at |
| `verification` | id, identifier, value, expires_at, created_at, updated_at |
| `rate_limit` | id, key, count, last_request (bigint) |

Application tables introduced by this spec:

| Table | Columns | Notes |
|---|---|---|
| `user_settings` | user_id (PK, FK user cascade), timezone (text, nullable until detected), daily_target_minutes (int, default 120), analysis_enabled (bool, default false), analysis_audio_enabled (bool, default false), analysis_consented_at (timestamptz, null), deep_work_block_minutes (int, default 25), leaderboard_enabled (bool, default false), share_reports_default (bool, default false), notification_prefs (jsonb, default `{}`), created_at, updated_at | Created in `databaseHooks.user.create.after`; later specs read and extend it |
| `auth_attempts` | key (text PK), count (int), window_start (timestamptz) | Per-IP+identifier limiter; rows older than 24 h are pruned by the Scheduler in spec 05 |
| `email_outbox` | id (uuid PK), to_email, subject, html, text, created_at | Only written by `CaptureTransport` in test mode |

All timestamps are `timestamptz`. Foreign keys to `user.id` use `ON DELETE CASCADE` so Better Auth's hard delete removes dependent rows within one transaction (F1-R11.2).

Zod schemas (in `web/lib/validation/auth.ts`): `signUpSchema` (email, username `/^[a-z0-9_]{3,20}$/` after lowercasing, name 1–50 trimmed, password ≥ 10), `signInSchema` (identifier, password), `displayNameSchema`, `timezoneSchema` (must be in `Intl.supportedValuesOf("timeZone")`), `deleteAccountSchema` (typed username).

## Correctness Properties

Invariants that must hold for every input, not only the examples in the tests. Each is checked by a property-based test (fast-check) or an API/E2E test as noted. Requirement references use this spec's numbering: `3.2` means Requirement 3 (F1-R3), criterion 2.

### Property 1: Username derivation is well-formed and idempotent

*For any* string `email`, `deriveUsername(email)` matches `/^[a-z0-9_]{3,20}$/`, and applying `deriveUsername` to its own output (as a local part) returns the same value.

**Verified by:** Property-based test (fast-check) on `lib/domain/username.ts`.

**Validates: Requirements 3.2, 4.2**

### Property 2: Username collision resolution terminates and stays unique

*For any* existing set of usernames and any base, `ensureUsername` returns a value not in the set, at most 20 characters long, and terminates within `size(set) + 1` iterations.

**Verified by:** Property-based test with an in-memory lookup.

**Validates: Requirements 3.2**

### Property 3: Password policy is exactly length and denylist

*For any* input in scope, `isAcceptablePassword(pw).ok` is true exactly when `pw.length >= 10` and `pw.toLowerCase()` is not in the denylist; the result does not depend on trimming or on any external state.

**Verified by:** Property-based test on `password-policy.ts`.

**Validates: Requirements 4.3**

### Property 4: Fixed-window limiter never exceeds its maximum

*For any* sequence of attempts sharing a key within one window, at most `max` are allowed; the first attempt after the window elapses is allowed and resets the count; `retryAfterSeconds` is always in `(0, window]`.

**Verified by:** Property-based test on `computeRetryAfter`; API test running the atomic statement concurrently against Postgres.

**Validates: Requirements 7.1, 7.2, 5.4**

### Property 5: Sign-up is indistinguishable for existing and new emails

*For any* input in scope, Sign-up responses for an existing email and for a new email have the same HTTP status and the same set of top-level body keys, and neither response carries a `Set-Cookie` header.

**Verified by:** API test.

**Validates: Requirements 4.5, 4.6**

### Property 6: Sign-in failures reveal nothing about account existence

*For any* input in scope, Sign-in responses for a wrong password and for an unknown identifier have the same status and message, and the difference of mean response times over 20 samples each is below 100 ms.

**Verified by:** API test with repeated sampling.

**Validates: Requirements 4.8, 7.3**

### Property 7: Session lifetime is bounded and extension is throttled

*For any* input in scope, After any request, `session.expiresAt - now` never exceeds 30 days; a request made less than 24 hours after the previous extension leaves `expiresAt` unchanged.

**Verified by:** API test with a mocked clock.

**Validates: Requirements 9.2**

### Property 8: Admin membership is exact

*For any* input in scope, `isAdmin(email)` is true exactly when the lowercased, trimmed email appears among the lowercased, trimmed, comma-separated entries of `ADMIN_EMAILS`; empty entries and whitespace never grant admin.

**Verified by:** Property-based test.

**Validates: Requirements 10.3, 10.5**

### Property 9: Theme text always meets contrast

*For any* input in scope, For every (text color, surface color) pair used by the theme, WCAG contrast is at least 4.5:1.

**Verified by:** Unit test iterating over the token map.

**Validates: Requirements 2.2**

### Property 10: Stored timezones are always valid IANA names

*For any* input in scope, `user_settings.timezone` is either null or a member of `Intl.supportedValuesOf("timeZone")`; the server rejects any other value.

**Verified by:** Property-based test on `timezoneSchema`; API test.

**Validates: Requirements 8.5, 8.6**

### Property 11: Account deletion leaves no dangling references

*For any* input in scope, After `deleteUser`, no row in any table with a foreign key to `user.id` references the deleted id.

**Verified by:** API test enumerating FK tables from `information_schema`.

**Validates: Requirements 11.2**

### Property 12: Environment validation reports exactly the offending variables

*For any* environment missing or malforming a required variable, startup fails and the error lists exactly the offending variable names and no values.

**Verified by:** Property-based test over subsets of required keys.

**Validates: Requirements 1.3**

### Property 13: Protected routes round-trip through sign-in

*For any* input in scope, Every route under `(app)` requested without a session cookie redirects to `/sign-in?next=<original path>` and, after sign-in, lands on that path.

**Verified by:** E2E test over the route list.

**Validates: Requirements 9.5**

## Error Handling

| Situation | Behaviour |
|---|---|
| Invalid form input | Zod parse on the server; field-level messages; input never echoed in logs |
| Wrong credentials or unknown identifier | Better Auth returns the same 401 message; UI shows "Incorrect email/username or password" (F1-R4.8) |
| Existing email at sign-up | Synthetic success response; "account exists" email sent; UI shows the same "Check your email" page (F1-R4.5) |
| Rate limit exceeded | 429 with `Retry-After` (policy hook) or `X-Retry-After` (built-in limiter); UI reads either header and shows "Too many attempts. Try again in N minutes" (F1-R7.2) |
| Registration closed | `validateUserInfo` returns `registration_closed`; email sign-up returns 403 with the message, Google flow lands on `/sign-in?error=registration_closed`; sign-up entry points hidden (F1-R10.1, F1-R10.2) |
| Unverified Google email | `validateUserInfo` returns `email_not_verified`; no account created (F1-R3.4) |
| OAuth failure or cancel | Redirect to `/sign-in?error=oauth_failed` with a plain message; no partial account (F1-R3.5) |
| Expired or used verification/reset link | `/verify-email?error=…` and `/reset-password?error=…` pages explain and offer a new link (F1-R5.3, F1-R6.4) |
| Deletion without a fresh session | Server action returns `needsReauth`; UI sends the user to sign in again and back to Settings › Account |
| Email provider failure | Logged with user id; auth flow unaffected; user can resend (F1-R5.4) |
| Database unreachable | `/api/health` 503; auth endpoints return 500 and the UI shows a generic retry message; nothing is cached as authenticated |
| Unhandled render error | `app/error.tsx` and `not-found.tsx` pastel pages; server log with request id; no stack trace to the client |

## Testing Strategy

- **Unit (Vitest, node)**: `deriveUsername` (normalization, truncation, collision suffixes), `isAcceptablePassword` (length, denylist, case), `computeRetryAfter`, `isAdmin` parsing, env schema failure lists variable names only, WCAG contrast of all text/surface token pairs ≥ 4.5:1, timezone validation.
- **Component (Vitest, jsdom, Testing Library)**: sign-in form splits email vs username, sign-up validation messages, unverified banner dismiss/reappear, top vs bottom nav rendering, empty state and skeleton components, initials avatar.
- **API (Vitest, node, real Postgres from `DATABASE_URL_TEST`, tables truncated between tests)**: sign-up creates user and settings without a session cookie; existing-email sign-up returns an identical status and body shape and writes an "account exists" email to the outbox; sign-in by email and by username; identical error for unknown identifier and wrong password; 6th attempt within 15 minutes returns 429 with a retry header; denylisted password rejected on sign-up, reset, and change; verification link from the outbox marks the email verified and sets a cookie; resend within 60 s rejected; reset link revokes all sessions; change password revokes other sessions; `REGISTRATION_OPEN=false` rejects email and Google sign-up (validator unit-tested with an OAuth `source`); admin route 404 for non-admins; deletion removes `user_settings`; health 200 and 503 (pool pointed at a closed port); timing test: 20 sign-ins each for existing and non-existing identifiers, assert the difference of means is under 100 ms.
- **E2E (Playwright, `next build && next start`, `E2E_TEST_MODE=true`, `EMAIL_TRANSPORT=capture`)**: sign-up → check-email → read `/api/test/outbox` → open verification link → signed in on Home; sign-in with email and with username; forgot → reset via outbox link → "Password updated" → sign in with the new password; sign out; a separate server start with `REGISTRATION_OPEN=false` asserts the closed message; `@axe-core/playwright` scans on sign-in, sign-up, settings, privacy with zero serious or critical violations.
- **CI (`.github/workflows/ci.yml`)**: parallel jobs `lint-typecheck`, `unit`, `api` (Postgres 16 service), `build` (includes the bundle-budget check), `e2e` (Playwright browsers cached), `audit` (`npm audit --audit-level=high`); `migrate` job on `main` pushes. Node 22, `npm ci` with cache; target under 10 minutes.

## Requirements Traceability

| Requirement | Design elements |
|---|---|
| F1-R1 | Project scaffold, `lib/env.ts` + `instrumentation.ts`, `api/health`, CI workflow, `.env.example`, npm scripts |
| F1-R2 | `globals.css` tokens, shadcn mapping, shell components, `loading.tsx` skeletons, reduced-motion CSS, focus ring, empty state, bundle-budget script, contrast test |
| F1-R3 | `socialProviders.google`, account linking, `validateUserInfo`, `ensureUsername`, sign-in page error mapping, `next` redirect |
| F1-R4 | `autoSignIn: false`, username plugin options, `password-policy.ts`, `beforeHook` existing-email email, sign-in identifier split, generic messages |
| F1-R5 | `emailVerification` config, `verify-email.tsx`, `/check-email`, `/verify-email` error page, `unverified-banner.tsx`, 60 s cooldown in `beforeHook`; suppression of notification emails is enforced by `notify()` in spec 05 |
| F1-R6 | `requestPasswordReset`/`resetPassword` flow, `revokeSessionsOnPasswordReset`, `changePassword` with `revokeOtherSessions`, "Set a password" path |
| F1-R7 | Built-in limiter (`storage: "database"`, `customRules`), `identifier-limit.ts`, timing floor in `afterHook`, sign-up 10/hour rule |
| F1-R8 | Settings sections registry, profile form, `InitialsAvatar`, `timezone-sync.tsx`, timezone combobox |
| F1-R9 | `session` config, cookie defaults, sign out and `revokeSessions`, `proxy.ts` optimistic redirect + `requireUser` |
| F1-R10 | `validateUserInfo` registration gate, hidden sign-up entry points, `requireAdmin`, Admin page with `UserStats` and `UsageStats` slot |
| F1-R11 | `deleteUser` config, `deletion.ts` registry, `ON DELETE CASCADE`, typed-username server action, `/goodbye` |
| F1-R12 | `privacy` and `terms` pages, footer and sign-up links |

## Implementation notes to confirm against installed versions

- Better Auth endpoint path strings used in `customRules` and the policy hook (password reset request path, verification resend path).
- Whether `APIError` accepts response headers in the installed version; otherwise set `Retry-After` through `ctx.context.responseHeaders` in the after hook.
- The header Vercel uses for the client IP (`x-real-ip` expected); adjust `advanced.ipAddress.ipAddressHeaders` if different.
- The shape of `.next/app-build-manifest.json` under Next.js 16 for the bundle-budget script.
- shadcn/ui CLI flags for Tailwind v4 and React 19 at initialization time.
