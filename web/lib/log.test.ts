import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getRequestId,
  isSensitiveKey,
  log,
  redact,
  setLogSink,
  type LogLevel,
} from "./log";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function captureLogs(): Array<{ level: LogLevel; line: string }> {
  const lines: Array<{ level: LogLevel; line: string }> = [];
  setLogSink((level, line) => lines.push({ level, line }));
  return lines;
}

describe("isSensitiveKey", () => {
  it.each(["email", "name", "password", "token", "cookie"])(
    "matches %s exactly",
    (key) => {
      expect(isSensitiveKey(key)).toBe(true);
    },
  );

  it.each([
    "Email",
    "PASSWORD",
    "accessToken",
    "refresh_token",
    "set-cookie",
    "userEmail",
    "passwordHash",
    "displayName",
  ])("matches %s by case-insensitive containment", (key) => {
    expect(isSensitiveKey(key)).toBe(true);
  });

  it.each(["userId", "requestId", "route", "status", "durationMs", "id"])(
    "leaves %s alone",
    (key) => {
      expect(isSensitiveKey(key)).toBe(false);
    },
  );
});

describe("redact", () => {
  it("strips the sensitive keys at the top level and keeps the rest", () => {
    const out = redact({
      userId: "u_1",
      email: "a@example.com",
      name: "Ada",
      password: "hunter22hunter22",
      token: "tok",
      cookie: "sid=1",
      status: 200,
    });

    expect(out).toEqual({ userId: "u_1", status: 200 });
  });

  it("strips nested keys, inside arrays, case-insensitively and by containment", () => {
    const out = redact({
      route: "/api/x",
      user: { id: "u_1", Email: "a@example.com", displayName: "Ada" },
      headers: { "set-cookie": "sid=1", "x-request-id": "r-1" },
      attempts: [
        { accessToken: "t1", ok: false },
        { passwordHash: "h", ok: true },
      ],
    });

    expect(out).toEqual({
      route: "/api/x",
      user: { id: "u_1" },
      headers: { "x-request-id": "r-1" },
      attempts: [{ ok: false }, { ok: true }],
    });
  });

  it("does not mutate its input", () => {
    const input = { email: "a@example.com", nested: { token: "t", keep: 1 } };
    const snapshot = JSON.stringify(input);

    const out = redact(input);

    expect(JSON.stringify(input)).toBe(snapshot);
    expect(out).not.toBe(input);
    expect(out.nested).not.toBe(input.nested);
  });

  it("passes primitives through and converts values JSON cannot carry", () => {
    expect(redact("text")).toBe("text");
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
    expect(redact(BigInt(10))).toBe("10");
    expect(redact(new Date("2024-01-02T03:04:05.000Z"))).toBe(
      "2024-01-02T03:04:05.000Z",
    );
  });

  it("serializes errors to name and message without key filtering", () => {
    const out = redact({ error: new RangeError("out of range") }) as {
      error: Record<string, unknown>;
    };

    expect(out.error.name).toBe("RangeError");
    expect(out.error.message).toBe("out of range");
    expect(Object.keys(out.error).sort()).toEqual(["message", "name", "stack"]);
  });

  it("handles circular references without throwing", () => {
    const input: Record<string, unknown> = { id: 1 };
    input.self = input;
    input.list = [input];

    const out = redact(input);

    expect(out).toEqual({ id: 1, self: "[circular]", list: ["[circular]"] });
    expect(() => JSON.stringify(out)).not.toThrow();
  });

  it("keeps shared, non-circular references", () => {
    const shared = { ok: true };

    expect(redact({ a: shared, b: shared })).toEqual({
      a: { ok: true },
      b: { ok: true },
    });
  });
});

describe("log", () => {
  afterEach(() => {
    setLogSink();
    vi.restoreAllMocks();
  });

  it("emits one JSON line with level, time, event and the request fields", () => {
    const lines = captureLogs();

    log.info("request.completed", {
      requestId: "req-1",
      userId: "u_1",
      route: "/api/health",
      status: 200,
      durationMs: 12,
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]?.level).toBe("info");
    expect(lines[0]?.line).not.toContain("\n");

    const entry = JSON.parse(lines[0]?.line ?? "") as Record<string, unknown>;
    expect(entry).toEqual({
      level: "info",
      time: expect.any(String),
      event: "request.completed",
      requestId: "req-1",
      userId: "u_1",
      route: "/api/health",
      status: 200,
      durationMs: 12,
    });
    expect(Number.isNaN(Date.parse(entry.time as string))).toBe(false);
  });

  it("redacts sensitive fields before writing", () => {
    const lines = captureLogs();

    log.warn("auth.failed", {
      userId: "u_1",
      email: "a@example.com",
      details: { accessToken: "secret-token", reason: "expired" },
    });

    const line = lines[0]?.line ?? "";
    expect(line).not.toContain("a@example.com");
    expect(line).not.toContain("secret-token");
    expect(JSON.parse(line)).toEqual({
      level: "warn",
      time: expect.any(String),
      event: "auth.failed",
      userId: "u_1",
      details: { reason: "expired" },
    });
  });

  it("keeps its own level, time and event keys over caller fields", () => {
    const lines = captureLogs();

    log.error("real.event", {
      level: "info",
      event: "spoofed",
      time: "yesterday",
    });

    const entry = JSON.parse(lines[0]?.line ?? "") as Record<string, unknown>;
    expect(lines[0]?.level).toBe("error");
    expect(entry.level).toBe("error");
    expect(entry.event).toBe("real.event");
    expect(entry.time).not.toBe("yesterday");
  });

  it("writes to console by default, one method per level", () => {
    const info = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    log.info("a");
    log.warn("b");
    log.error("c");

    expect(info).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(JSON.parse(info.mock.calls[0]?.[0] as string)).toMatchObject({
      level: "info",
      event: "a",
    });
  });
});

describe("getRequestId", () => {
  it("returns a well-formed x-request-id header", () => {
    expect(getRequestId(new Headers({ "x-request-id": "req_ABC-123.4" }))).toBe(
      "req_ABC-123.4",
    );
  });

  it("generates a UUID when the header is absent", () => {
    expect(getRequestId(new Headers())).toMatch(UUID_PATTERN);
  });

  it.each(["", "has spaces", "a".repeat(129), 'x"y'])(
    "generates a UUID instead of using %j",
    (value) => {
      const id = getRequestId(new Headers({ "x-request-id": value }));

      expect(id).not.toBe(value);
      expect(id).toMatch(UUID_PATTERN);
    },
  );
});
