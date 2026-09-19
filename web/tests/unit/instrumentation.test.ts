// F1-R1.3: the server refuses to start on an invalid environment and logs
// only the names of the offending variables.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EnvValidationError,
  REQUIRED_ENV_KEYS,
  resetEnvCache,
} from "@/lib/env";
import { setLogSink, type LogLevel } from "@/lib/log";
import { register } from "@/instrumentation";

const validValues: Record<(typeof REQUIRED_ENV_KEYS)[number], string> = {
  DATABASE_URL: "postgresql://user:db-secret-value@host/db",
  BETTER_AUTH_SECRET: "auth-secret-value-0123456789abcdef",
  BETTER_AUTH_URL: "https://scholarly.example.com",
  GOOGLE_CLIENT_ID: "google-client-id-value",
  GOOGLE_CLIENT_SECRET: "google-client-secret-value",
  RESEND_API_KEY: "re_resend_api_key_value",
  EMAIL_FROM: "Scholarly <no-reply@scholarly.example.com>",
  NEXT_PUBLIC_APP_URL: "https://scholarly.example.com",
};

describe("F1-R1.3 instrumentation register()", () => {
  let lines: Array<{ level: LogLevel; entry: Record<string, unknown> }>;

  beforeEach(() => {
    lines = [];
    setLogSink((level, line) => {
      lines.push({ level, entry: JSON.parse(line) as Record<string, unknown> });
    });
    for (const [key, value] of Object.entries(validValues))
      vi.stubEnv(key, value);
    resetEnvCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
    setLogSink();
  });

  it("does nothing outside the Node.js runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    vi.stubEnv("DATABASE_URL", undefined);

    await expect(register()).resolves.toBeUndefined();
    expect(lines).toEqual([]);
  });

  it("rejects and logs only the offending variable names when the environment is invalid", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("BETTER_AUTH_URL", "not-a-url-value");

    await expect(register()).rejects.toBeInstanceOf(EnvValidationError);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.level).toBe("error");
    expect(lines[0]?.entry).toMatchObject({
      event: "env.invalid",
      variables: ["BETTER_AUTH_URL", "DATABASE_URL"],
    });

    const serialized = JSON.stringify(lines[0]?.entry);
    for (const value of [...Object.values(validValues), "not-a-url-value"]) {
      expect(serialized).not.toContain(value);
    }
  });

  it("resolves and logs a startup line when the environment is valid", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("REGISTRATION_OPEN", "false");

    await expect(register()).resolves.toBeUndefined();

    expect(lines).toHaveLength(1);
    expect(lines[0]?.level).toBe("info");
    expect(lines[0]?.entry).toMatchObject({
      event: "env.valid",
      nodeEnv: "test",
      transport: "resend",
      registrationOpen: false,
    });
    expect(JSON.stringify(lines[0]?.entry)).not.toContain(
      validValues.DATABASE_URL,
    );
  });
});
