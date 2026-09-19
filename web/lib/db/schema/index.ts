/**
 * Drizzle schema entry point. `drizzle.config.ts` points here and
 * `lib/db/client.ts` imports it as `import * as schema` so the typed query
 * builder and the relational API see every table.
 *
 * Task 3.1 adds `auth.ts` (Better Auth tables) and `settings.ts`
 * (`user_settings`, `auth_attempts`, `email_outbox`) and re-exports them
 * from here:
 *
 *   export * from "./auth";
 *   export * from "./settings";
 *
 * Until then the module is intentionally empty; the first migration is
 * generated together with those tables.
 */
export {};
