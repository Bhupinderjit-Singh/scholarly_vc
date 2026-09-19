import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit configuration (`npm run db:generate`, `npm run db:migrate`).
 *
 * Schema: `lib/db/schema/index.ts`. Migrations: `lib/db/migrations`
 * (generated, committed, never hand-edited; tech.md hard rule 8).
 *
 * Environment: drizzle-kit 0.31.10 loads `./.env` from the working
 * directory by itself (its CLI bundles `dotenv/config`; verified against the
 * installed `bin.cjs`), and a variable already present in the shell wins
 * over the file. So `npm run db:migrate` uses `DATABASE_URL` from `web/.env`
 * (the Neon `dev` branch) and
 * `DATABASE_URL="$DATABASE_URL_TEST" npm run db:migrate` migrates the `test`
 * branch. No extra env loading is needed here.
 *
 * `dbCredentials` is only set when `DATABASE_URL` is present: `generate`
 * needs no database, and `migrate` without a URL then fails with
 * drizzle-kit's own clear message instead of a connection attempt to
 * localhost.
 */
const url = process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema/index.ts",
  out: "./lib/db/migrations",
  ...(url === undefined || url === "" ? {} : { dbCredentials: { url } }),
});
