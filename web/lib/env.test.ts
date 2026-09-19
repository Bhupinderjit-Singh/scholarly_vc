import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EnvValidationError,
  getEnv,
  parseAdminEmails,
  parseEnv,
  REQUIRED_ENV_KEYS,
  resetEnvCache,
} from "./env";

// Exactly the required keys, with values distinctive enough that an assertion
// "the error never contains a value" is meaningful.
const validEnv: Record<string, string> = {
  DATABASE_URL:
    "postgresql://scholarly_user:db-secret-value@db.example.neon.tech/scholarly",
  BETTER_AUTH_SECRET: "auth-secret-value-0123456789abcdef",
  BETTER_AUTH_URL: "https://scholarly.example.com",
  GOOGLE_CLIENT_ID: "google-client-id-value.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "google-client-secret-value",
  RESEND_API_KEY: "re_resend_api_key_value",
  EMAIL_FROM: "Scholarly <no-reply@scholarly.example.com>",
  NEXT_PUBLIC_APP_URL: "https://scholarly.example.com",
};

function without(
  source: Record<string, string>,
  ...keys: string[]
): Record<string, string> {
  const copy = { ...source };
  for (const key of keys) delete copy[key];
  return copy;
}

function failure(
  source: Record<string, string | undefined>,
): EnvValidationError {
  try {
    parseEnv(source);
  } catch (error) {
    if (error instanceof EnvValidationError) return error;
    throw error;
  }
  throw new Error("expected parseEnv to throw");
}

describe("F1-R1.3 parseEnv", () => {
  it("accepts a valid environment and applies defaults", () => {
    const env = parseEnv(validEnv);

    expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(env.NODE_ENV).toBe("development");
    expect(env.REGISTRATION_OPEN).toBe(true);
    expect(env.ADMIN_EMAILS).toEqual([]);
    expect(env.EMAIL_TRANSPORT).toBe("resend");
    expect(env.E2E_TEST_MODE).toBe(false);
    expect(env.MONTHLY_MINUTES_PER_USER).toBe(1500);
    expect(env.MONTHLY_MINUTES_GLOBAL).toBe(4500);
    expect(env.ANALYSIS_HOURS_PER_USER).toBe(60);
    expect(env.ANALYSIS_HOURS_GLOBAL).toBe(400);
    expect(env.LIVEKIT_URL).toBeUndefined();
  });

  it("parses provided optional values", () => {
    const env = parseEnv({
      ...validEnv,
      NODE_ENV: "production",
      REGISTRATION_OPEN: "FALSE",
      ADMIN_EMAILS: " Owner@Example.com, ,friend@example.com ",
      EMAIL_TRANSPORT: "capture",
      E2E_TEST_MODE: "True",
      MONTHLY_MINUTES_GLOBAL: "9000",
      LIVEKIT_URL: "wss://scholarly.livekit.cloud",
    });

    expect(env.NODE_ENV).toBe("production");
    expect(env.REGISTRATION_OPEN).toBe(false);
    expect(env.ADMIN_EMAILS).toEqual([
      "owner@example.com",
      "friend@example.com",
    ]);
    expect(env.EMAIL_TRANSPORT).toBe("capture");
    expect(env.E2E_TEST_MODE).toBe(true);
    expect(env.MONTHLY_MINUTES_GLOBAL).toBe(9000);
    expect(env.LIVEKIT_URL).toBe("wss://scholarly.livekit.cloud");
  });

  it("treats empty strings for defaulted variables as unset", () => {
    const env = parseEnv({
      ...validEnv,
      ADMIN_EMAILS: "",
      REGISTRATION_OPEN: "",
      EMAIL_TRANSPORT: "  ",
      MONTHLY_MINUTES_GLOBAL: "",
      LIVEKIT_URL: "",
    });

    expect(env.ADMIN_EMAILS).toEqual([]);
    expect(env.REGISTRATION_OPEN).toBe(true);
    expect(env.EMAIL_TRANSPORT).toBe("resend");
    expect(env.MONTHLY_MINUTES_GLOBAL).toBe(4500);
    expect(env.LIVEKIT_URL).toBeUndefined();
  });

  it("drops variables it does not know about", () => {
    const env = parseEnv({ ...validEnv, PATH: "/usr/bin", SHELL: "/bin/zsh" });

    expect(env).not.toHaveProperty("PATH");
    expect(env).not.toHaveProperty("SHELL");
  });

  it("requires exactly REQUIRED_ENV_KEYS", () => {
    // The fixture holds only these keys and parses, so nothing else is
    // required; the loop below shows each of them is.
    expect(Object.keys(validEnv).sort()).toEqual([...REQUIRED_ENV_KEYS].sort());
  });

  it.each(REQUIRED_ENV_KEYS)(
    "reports %s alone when only it is missing",
    (key) => {
      const error = failure(without(validEnv, key));

      expect(error).toBeInstanceOf(EnvValidationError);
      expect(error.variables).toEqual([key]);
      expect(error.message).toBe(`Invalid environment variables: ${key}`);
    },
  );

  it.each(REQUIRED_ENV_KEYS)(
    "treats an empty or blank %s as missing",
    (key) => {
      expect(failure({ ...validEnv, [key]: "" }).variables).toEqual([key]);
      expect(failure({ ...validEnv, [key]: "   " }).variables).toEqual([key]);
    },
  );

  it("lists exactly the missing variables, sorted and without duplicates", () => {
    const error = failure({
      ...without(validEnv, "RESEND_API_KEY", "DATABASE_URL"),
      EMAIL_FROM: "",
    });

    expect(error.variables).toEqual([
      "DATABASE_URL",
      "EMAIL_FROM",
      "RESEND_API_KEY",
    ]);
    expect(error.message).toBe(
      "Invalid environment variables: DATABASE_URL, EMAIL_FROM, RESEND_API_KEY",
    );
  });

  it.each([
    ["BETTER_AUTH_URL", "not a url"],
    ["NEXT_PUBLIC_APP_URL", "scholarly.example.com"],
    ["BETTER_AUTH_SECRET", "short"],
    ["REGISTRATION_OPEN", "maybe"],
    ["REGISTRATION_OPEN", "1"],
    ["E2E_TEST_MODE", "yes"],
    ["EMAIL_TRANSPORT", "smtp"],
    ["NODE_ENV", "staging"],
    ["MONTHLY_MINUTES_GLOBAL", "-1"],
    ["MONTHLY_MINUTES_PER_USER", "12.5"],
    ["ANALYSIS_HOURS_GLOBAL", "lots"],
    ["WORKER_TRIGGER_URL", "modal.run/analyze"],
  ])("reports a malformed %s", (key, value) => {
    const error = failure({ ...validEnv, [key]: value });

    expect(error.variables).toEqual([key]);
    expect(error.message).not.toContain(value);
  });

  it("combines missing and malformed variables in one error", () => {
    const error = failure({
      ...validEnv,
      GOOGLE_CLIENT_ID: undefined,
      BETTER_AUTH_URL: "nope",
      REGISTRATION_OPEN: "sometimes",
    });

    expect(error.variables).toEqual([
      "BETTER_AUTH_URL",
      "GOOGLE_CLIENT_ID",
      "REGISTRATION_OPEN",
    ]);
  });

  it("never includes a variable value in the error", () => {
    const malformed = {
      ...validEnv,
      BETTER_AUTH_URL: "definitely-not-a-url-value",
      REGISTRATION_OPEN: "sometimes-value",
      MONTHLY_MINUTES_GLOBAL: "-42",
    };

    const error = failure({ ...malformed, GOOGLE_CLIENT_SECRET: undefined });
    const serialized = JSON.stringify({
      message: error.message,
      variables: error.variables,
      own: { ...error },
    });

    for (const value of Object.values(malformed)) {
      expect(serialized).not.toContain(value);
    }
    expect(error).not.toHaveProperty("cause");
  });
});

describe("parseAdminEmails", () => {
  it("trims, lower-cases, drops empty entries and duplicates", () => {
    expect(
      parseAdminEmails(
        " Owner@Example.com ,, friend@example.com,OWNER@example.com ",
      ),
    ).toEqual(["owner@example.com", "friend@example.com"]);
  });

  it("returns an empty list for an empty string", () => {
    expect(parseAdminEmails("")).toEqual([]);
    expect(parseAdminEmails(" , ")).toEqual([]);
  });
});

describe("getEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  it("parses process.env once and caches the result", () => {
    for (const [key, value] of Object.entries(validEnv)) vi.stubEnv(key, value);
    resetEnvCache();

    const first = getEnv();
    vi.stubEnv("REGISTRATION_OPEN", "false");
    const second = getEnv();

    expect(second).toBe(first);
    expect(second.REGISTRATION_OPEN).toBe(true);

    resetEnvCache();
    expect(getEnv().REGISTRATION_OPEN).toBe(false);
  });

  it("throws EnvValidationError when process.env is invalid", () => {
    for (const [key, value] of Object.entries(validEnv)) vi.stubEnv(key, value);
    vi.stubEnv("DATABASE_URL", undefined);
    resetEnvCache();

    expect(() => getEnv()).toThrow(EnvValidationError);
    expect(() => getEnv()).toThrow(
      "Invalid environment variables: DATABASE_URL",
    );
  });
});
