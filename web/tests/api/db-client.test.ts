// F1-R1.2: the pool behind Drizzle, and how TLS is decided from the
// connection string (see the comment on `resolveConnection`).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client, type Pool } from "pg";

import {
  createDb,
  createPool,
  DEFAULT_CONNECTION_TIMEOUT_MS,
  DEFAULT_POOL_MAX,
  resolveConnection,
} from "@/lib/db/client";

const NEON_URL =
  "postgresql://neondb_owner:pw@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const PLAIN_URL =
  "postgresql://postgres:postgres@localhost:5432/scholarly_test";

/** What `pg` will actually use for TLS once it merges the URL over the config. */
function effectiveSsl(pool: Pool): unknown {
  return new Client(pool.options).ssl;
}

describe("resolveConnection", () => {
  it("turns sslmode=require into verified TLS and drops the parameter", () => {
    expect(resolveConnection(NEON_URL)).toEqual({
      connectionString:
        "postgresql://neondb_owner:pw@ep-x.eu-central-1.aws.neon.tech/neondb?channel_binding=require",
      ssl: { rejectUnauthorized: true },
    });
  });

  it.each(["verify-full", "prefer", "verify-ca", "no-verify"])(
    "never downgrades verification for sslmode=%s",
    (mode) => {
      const resolved = resolveConnection(
        `postgresql://u:p@host/db?sslmode=${mode}`,
      );
      expect(resolved.ssl).toEqual({ rejectUnauthorized: true });
      expect(resolved.connectionString).toBe("postgresql://u:p@host/db");
    },
  );

  it("turns sslmode=disable into ssl: false", () => {
    expect(
      resolveConnection("postgresql://u:p@host/db?sslmode=disable"),
    ).toEqual({ connectionString: "postgresql://u:p@host/db", ssl: false });
  });

  it("leaves a URL without sslmode alone (CI service container)", () => {
    expect(resolveConnection(PLAIN_URL)).toEqual({
      connectionString: PLAIN_URL,
      ssl: undefined,
    });
  });

  it("keeps an encoded password intact", () => {
    const { connectionString } = resolveConnection(
      "postgresql://u:p%40ss%2Fw0rd@host:6543/db?sslmode=require",
    );
    expect(connectionString).toBe("postgresql://u:p%40ss%2Fw0rd@host:6543/db");
  });

  it("returns input it cannot parse unchanged", () => {
    const socket = "/var/run/postgresql scholarly";
    expect(resolveConnection(socket)).toEqual({
      connectionString: socket,
      ssl: undefined,
    });
  });
});

describe("createPool", () => {
  const pools: Pool[] = [];
  function track(pool: Pool): Pool {
    pools.push(pool);
    return pool;
  }

  beforeEach(() => {
    // `pg` falls back to PGSSLMODE when neither the URL nor the config sets ssl.
    vi.stubEnv("PGSSLMODE", undefined);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(pools.splice(0).map((pool) => pool.end()));
  });

  it("applies the defaults: max 5, 5 s connection timeout", () => {
    const pool = track(createPool(PLAIN_URL));
    expect(pool.options.max).toBe(DEFAULT_POOL_MAX);
    expect(pool.options.max).toBe(5);
    expect(pool.options.connectionTimeoutMillis).toBe(
      DEFAULT_CONNECTION_TIMEOUT_MS,
    );
    expect(pool.options.connectionString).toBe(PLAIN_URL);
    expect(pool.options.ssl).toBeUndefined();
    expect(effectiveSsl(pool)).toBe(false);
  });

  it("verifies TLS for a Neon URL, with the ssl option in charge", () => {
    const pool = track(createPool(NEON_URL));
    expect(pool.options.connectionString).not.toContain("sslmode");
    expect(pool.options.connectionString).toContain("channel_binding=require");
    expect(pool.options.ssl).toEqual({ rejectUnauthorized: true });
    expect(effectiveSsl(pool)).toEqual({ rejectUnauthorized: true });
  });

  it("turns TLS off for sslmode=disable", () => {
    const pool = track(createPool(`${PLAIN_URL}?sslmode=disable`));
    expect(pool.options.ssl).toBe(false);
    expect(effectiveSsl(pool)).toBe(false);
  });

  it("lets overrides win", () => {
    const pool = track(
      createPool(PLAIN_URL, { max: 1, connectionTimeoutMillis: 300 }),
    );
    expect(pool.options.max).toBe(1);
    expect(pool.options.connectionTimeoutMillis).toBe(300);
  });

  it("has an error listener so a dropped idle connection cannot crash the process", () => {
    const pool = track(createPool(PLAIN_URL));
    expect(pool.listenerCount("error")).toBe(1);
  });

  it("wraps the pool in Drizzle and exposes it as $client", () => {
    const pool = track(createPool(PLAIN_URL));
    const db = createDb(pool);
    expect(db.$client).toBe(pool);
  });
});
