// F1-R1.4: GET /api/health answers within 2 s with 200 { status: "ok",
// db: "ok" } or 503 { status: "degraded", db: "unreachable" }.
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";

import { createPool } from "@/lib/db/client";
import {
  checkDatabase,
  handleHealth,
  type HealthBody,
  type HealthQueryable,
} from "@/lib/db/health";
import { setLogSink, type LogLevel } from "@/lib/log";
import * as route from "@/app/api/health/route";

import { getTestPool, hasTestDatabase, TEST_DATABASE_VARIABLE } from "./setup";

/** A closed port: connection attempts are refused immediately. */
const CLOSED_PORT_URL = "postgresql://health:health-secret@127.0.0.1:1/health";

type LogLine = { level: LogLevel; entry: Record<string, unknown> };

function captureLogs(): LogLine[] {
  const lines: LogLine[] = [];
  setLogSink((level, line) => {
    lines.push({ level, entry: JSON.parse(line) as Record<string, unknown> });
  });
  return lines;
}

function healthRequest(headers?: HeadersInit): Request {
  return new Request("http://localhost/api/health", { headers });
}

if (!hasTestDatabase()) {
  console.info(
    `[tests/api/health] ${TEST_DATABASE_VARIABLE} is not set: skipping the 200 test against a real database; the 503 and timeout tests still run.`,
  );
}

describe("route module", () => {
  it("runs on the Node runtime, is never prerendered, and exposes GET", () => {
    expect(route.runtime).toBe("nodejs");
    expect(route.dynamic).toBe("force-dynamic");
    expect(typeof route.GET).toBe("function");
  });
});

describe.skipIf(!hasTestDatabase())("with the test database", () => {
  let lines: LogLine[];

  beforeEach(() => {
    lines = captureLogs();
  });

  afterEach(() => {
    setLogSink();
  });

  it("responds 200 { status: 'ok', db: 'ok' } with no-store caching", async () => {
    const response = await handleHealth(healthRequest(), getTestPool());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual<HealthBody>({
      status: "ok",
      db: "ok",
    });
    expect(lines).toEqual([
      expect.objectContaining({
        level: "info",
        entry: expect.objectContaining({
          event: "health.request",
          route: "/api/health",
          status: 200,
        }),
      }),
    ]);
  });
});

describe("when SELECT 1 settles (fake pool)", () => {
  afterEach(() => {
    setLogSink();
  });

  it("responds 200 { status: 'ok', db: 'ok' } and logs the request", async () => {
    const lines = captureLogs();
    const pool: HealthQueryable = { query: async () => ({ rows: [] }) };

    const response = await handleHealth(
      healthRequest({ "x-request-id": "req-health-200" }),
      pool,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual<HealthBody>({
      status: "ok",
      db: "ok",
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.entry).toMatchObject({
      event: "health.request",
      requestId: "req-health-200",
      route: "/api/health",
      status: 200,
    });
  });
});

describe("when the database is unreachable", () => {
  let pool: Pool;
  let lines: LogLine[];

  beforeEach(() => {
    pool = createPool(CLOSED_PORT_URL, { connectionTimeoutMillis: 300 });
    lines = captureLogs();
  });

  afterEach(async () => {
    setLogSink();
    await pool.end();
  });

  it("responds 503 { status: 'degraded', db: 'unreachable' } within 2.5 s", async () => {
    const startedAt = performance.now();
    const response = await handleHealth(
      healthRequest({ "x-request-id": "req-health-503" }),
      pool,
    );
    const elapsedMs = performance.now() - startedAt;

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual<HealthBody>({
      status: "degraded",
      db: "unreachable",
    });
    expect(elapsedMs).toBeLessThan(2500);
  });

  it("logs the failure and the request without the connection string", async () => {
    await handleHealth(
      healthRequest({ "x-request-id": "req-health-log" }),
      pool,
    );

    const events = lines.map((line) => line.entry.event);
    expect(events).toEqual(["health.db_unreachable", "health.request"]);

    const [failure, request] = lines;
    expect(failure?.level).toBe("warn");
    expect(failure?.entry).toMatchObject({ reason: "error" });
    expect(request?.level).toBe("info");
    expect(request?.entry).toMatchObject({
      requestId: "req-health-log",
      route: "/api/health",
      status: 503,
    });
    expect(typeof request?.entry.durationMs).toBe("number");

    const serialized = JSON.stringify(lines);
    expect(serialized).not.toContain("health-secret");
    expect(serialized).not.toContain(CLOSED_PORT_URL);
  });
});

describe("checkDatabase", () => {
  const settled: HealthQueryable = {
    query: async () => ({ rows: [{ "?column?": 1 }] }),
  };
  const failing: HealthQueryable = {
    query: () => Promise.reject(new Error("connection refused")),
  };
  const hanging: HealthQueryable = {
    query: () => new Promise<never>(() => {}),
  };

  afterAll(() => {
    setLogSink();
  });

  it("returns 'ok' when SELECT 1 settles", async () => {
    captureLogs();
    await expect(checkDatabase(settled)).resolves.toBe("ok");
  });

  it("returns 'unreachable' when the query rejects", async () => {
    const lines = captureLogs();
    await expect(checkDatabase(failing)).resolves.toBe("unreachable");
    expect(lines).toHaveLength(1);
    expect(lines[0]?.entry).toMatchObject({
      event: "health.db_unreachable",
      reason: "error",
    });
  });

  it("returns 'unreachable' once the timeout elapses while the query hangs", async () => {
    const lines = captureLogs();
    const startedAt = performance.now();

    await expect(checkDatabase(hanging, 50)).resolves.toBe("unreachable");

    expect(performance.now() - startedAt).toBeGreaterThanOrEqual(45);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.entry).toMatchObject({
      event: "health.db_unreachable",
      reason: "timeout",
      timeoutMs: 50,
    });
  });
});
