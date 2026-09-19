import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

import { getEnv } from "@/lib/env";
import { log } from "@/lib/log";

import * as schema from "./schema";

/**
 * Database access (tech.md hard rule 8; requirement F1-R1.2).
 *
 * One `pg.Pool` per process wrapped by Drizzle. The same driver talks to
 * Neon's pooled connection string in production, a Neon branch in
 * development and local API tests, and the plain Postgres 16 service
 * container in CI, so nothing here is Neon-specific.
 *
 * Nothing reads the environment at import time: `getPool()` / `getDb()`
 * call `getEnv()` on first use, so importing this module during
 * `next build` or in tests without a `.env` is safe (design "web/lib/db").
 * Server-only: never import from client components.
 */

/** Small app, small pool: Neon's free tier and Vercel functions both prefer few connections. */
export const DEFAULT_POOL_MAX = 5;

/** Time to establish one connection before `pg` gives up on it. */
export const DEFAULT_CONNECTION_TIMEOUT_MS = 5000;

/** The Drizzle database type for this app's schema. */
export type Db = NodePgDatabase<typeof schema> & { $client: Pool };

/** Connection settings derived from a connection string; see `resolveConnection`. */
export interface ResolvedConnection {
  /** The input with its `sslmode` query parameter removed. */
  connectionString: string;
  /** Value for `pg`'s `ssl` option, or `undefined` to leave TLS off. */
  ssl: PoolConfig["ssl"];
}

/**
 * Decides TLS from the URL's `sslmode` and moves that decision into `pg`'s
 * explicit `ssl` option.
 *
 * Why not pass the URL through untouched? Checked against the installed
 * `pg` 8.23.0 / `pg-connection-string` 2.14.0:
 *
 * - `ConnectionParameters` merges the parsed connection string *over* the
 *   config object, so an `sslmode` in the URL silently overrides any `ssl`
 *   option given to `new Pool(...)`. Passing both is double configuration
 *   in which the option loses.
 * - `sslmode=require` (also `prefer`, `verify-ca`) currently means full
 *   verification (`ssl: {}`, Node's default `rejectUnauthorized: true`) but
 *   emits a one-time "SECURITY WARNING" deprecation, and pg 9 will switch
 *   these modes to libpq semantics, where `require` skips certificate
 *   verification. `sslmode=verify-full` verifies silently, `disable` turns
 *   TLS off, `no-verify` disables verification.
 * - Without `sslmode` in the URL the `ssl` option is honored; with neither,
 *   `PGSSLMODE` or the default (off) applies.
 *
 * So: strip `sslmode` and set `ssl` ourselves. Any mode other than
 * `disable` becomes `{ rejectUnauthorized: true }` (chain and host name
 * checked; `pg` sets `servername` from the URL host), which keeps Neon's
 * `?sslmode=require` fully verified on pg 9 too and avoids the warning.
 * `disable` becomes `ssl: false`. A URL without `sslmode` (CI's service
 * container) leaves `ssl` unset. Verification is never downgraded here:
 * `no-verify` is upgraded on purpose (tech.md "Security").
 *
 * Other query parameters (Neon adds `channel_binding=require`) are kept.
 * Inputs `URL` cannot parse (unix socket paths) are returned unchanged.
 */
export function resolveConnection(
  connectionString: string,
): ResolvedConnection {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return { connectionString, ssl: undefined };
  }
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode === null) return { connectionString, ssl: undefined };
  url.searchParams.delete("sslmode");
  return {
    connectionString: url.toString(),
    ssl: sslmode === "disable" ? false : { rejectUnauthorized: true },
  };
}

/**
 * A `pg.Pool` with this app's defaults: `max` 5, a 5 s connection timeout,
 * TLS per `resolveConnection`, and an `error` listener. `overrides` are
 * applied last (tests shrink the timeout and point at a closed port).
 */
export function createPool(
  connectionString: string,
  overrides: Omit<PoolConfig, "connectionString"> = {},
): Pool {
  const resolved = resolveConnection(connectionString);
  const pool = new Pool({
    connectionString: resolved.connectionString,
    max: DEFAULT_POOL_MAX,
    connectionTimeoutMillis: DEFAULT_CONNECTION_TIMEOUT_MS,
    ...(resolved.ssl === undefined ? {} : { ssl: resolved.ssl }),
    ...overrides,
  });
  // An idle client whose connection the server drops (Neon closes idle
  // connections) emits `error` on the pool; without a listener Node treats
  // that as an unhandled error event and exits the process. The pool
  // discards the client, so logging is all that is needed.
  pool.on("error", (error) => {
    log.warn("db.pool_error", { error });
  });
  return pool;
}

/** Drizzle over an existing pool; `db.$client` is the pool. */
export function createDb(pool: Pool): Db {
  return drizzle({ client: pool, schema });
}

let pool: Pool | undefined;
let db: Db | undefined;

/** The process-wide pool on `DATABASE_URL`, created on first call. */
export function getPool(): Pool {
  pool ??= createPool(getEnv().DATABASE_URL);
  return pool;
}

/** The process-wide Drizzle database over `getPool()`, created on first call. */
export function getDb(): Db {
  db ??= createDb(getPool());
  return db;
}
