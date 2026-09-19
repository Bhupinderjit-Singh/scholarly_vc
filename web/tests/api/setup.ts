// Setup for the `api` Vitest project (registered in `vitest.config.mts`;
// runs before every file under `tests/api`).
//
// - Loads `web/.env.test`, else `web/.env`, into `process.env` with Node's
//   `process.loadEnvFile` (variables already set in the shell win; Vitest
//   itself only exposes `VITE_*` variables from .env files).
// - Exposes the shared test database on `DATABASE_URL_TEST` (the Neon
//   `test` branch locally, the Postgres service container in CI) through
//   `getTestPool()` and truncates every table in `public` before each test
//   file so files never see each other's rows.
// - Tests that need the database guard themselves with
//   `describe.skipIf(!hasTestDatabase())` so a checkout without a database
//   still runs everything else.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll } from "vitest";
import type { Pool } from "pg";

import { createPool } from "@/lib/db/client";

for (const file of [".env.test", ".env"]) {
  const path = fileURLToPath(new URL(`../../${file}`, import.meta.url));
  if (existsSync(path)) {
    process.loadEnvFile(path);
    break;
  }
}

export const TEST_DATABASE_VARIABLE = "DATABASE_URL_TEST";

function testDatabaseUrl(): string | undefined {
  const value = process.env[TEST_DATABASE_VARIABLE];
  return value !== undefined && value.trim() !== "" ? value : undefined;
}

/** True when `DATABASE_URL_TEST` is set; database-backed tests skip otherwise. */
export function hasTestDatabase(): boolean {
  return testDatabaseUrl() !== undefined;
}

let testPool: Pool | undefined;

/**
 * The pool on `DATABASE_URL_TEST`, created on first use and closed after
 * the file's tests. Refuses to run against the development database: the
 * tables are truncated before every test file.
 */
export function getTestPool(): Pool {
  if (testPool !== undefined) return testPool;
  const url = testDatabaseUrl();
  if (url === undefined) {
    throw new Error(
      `${TEST_DATABASE_VARIABLE} is not set; guard database tests with describe.skipIf(!hasTestDatabase())`,
    );
  }
  if (url === process.env.DATABASE_URL) {
    throw new Error(
      `${TEST_DATABASE_VARIABLE} must point at a separate database (the Neon "test" branch); it equals DATABASE_URL, whose tables would be truncated`,
    );
  }
  testPool = createPool(url);
  return testPool;
}

/**
 * Empties every base table in `public` (`TRUNCATE ... RESTART IDENTITY
 * CASCADE`), leaving the schema in place. Drizzle's migration journal
 * (`__drizzle_migrations`, kept in the `drizzle` schema by default) is never
 * touched. No-op before the first migration, when there are no tables.
 */
export async function resetDatabase(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name <> '__drizzle_migrations'
      ORDER BY table_name`,
  );
  if (rows.length === 0) return;
  const tables = rows
    .map((row) => `"public"."${row.table_name.replaceAll('"', '""')}"`)
    .join(", ");
  await pool.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

beforeAll(async () => {
  if (hasTestDatabase()) await resetDatabase(getTestPool());
});

afterAll(async () => {
  const pool = testPool;
  testPool = undefined;
  await pool?.end();
});
