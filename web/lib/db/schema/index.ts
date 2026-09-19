/**
 * Drizzle schema entry point. `drizzle.config.ts` points here and
 * `lib/db/client.ts` imports it as `import * as schema` so the typed query
 * builder, the relational API and the Better Auth adapter see every table.
 *
 * - `auth.ts`: Better Auth tables (`user`, `session`, `account`,
 *   `verification`, `rate_limit`), generated with `@better-auth/cli`.
 * - `settings.ts`: `user_settings`, `auth_attempts`, `email_outbox`.
 *
 * Later specs add one module per area (`sessions.ts`, `tracking.ts`, ...)
 * and re-export it from here; `npm run db:generate` then writes the next
 * migration.
 */
export * from "./auth";
export * from "./settings";
