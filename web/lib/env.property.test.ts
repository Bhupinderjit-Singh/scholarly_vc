import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  type EnvSource,
  EnvValidationError,
  parseEnv,
  REQUIRED_ENV_KEYS,
  type RequiredEnvKey,
} from "./env";

/**
 * Property 12 (design.md): for any environment missing or malforming a
 * required variable, `parseEnv` fails and the error lists exactly the
 * offending variable names and no values. Requirement F1-R1.3.
 */

const RUNS = 250;

// Exactly the required keys. Every value is at least 8 characters and mixes
// lower-case letters with digits or punctuation, so none can occur by accident
// inside an error message made of upper-case variable names.
const validEnv: Readonly<Record<RequiredEnvKey, string>> = {
  DATABASE_URL:
    "postgresql://scholarly_user:db-secret-value-7f3a@db.example.neon.tech/scholarly",
  BETTER_AUTH_SECRET: "auth-secret-value-0123456789abcdef",
  BETTER_AUTH_URL: "https://auth.scholarly-fixture.example",
  GOOGLE_CLIENT_ID: "google-client-id-value-9c1e.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "google-client-secret-value-4b2d",
  RESEND_API_KEY: "re_resend_api_key_value_5e6f",
  EMAIL_FROM: "Scholarly <no-reply@scholarly-fixture.example>",
  NEXT_PUBLIC_APP_URL: "https://app.scholarly-fixture.example",
};

const fixtureValues: readonly string[] = Object.values(validEnv);

function envWithout(keys: readonly RequiredEnvKey[]): Record<string, string> {
  const copy: Record<string, string> = { ...validEnv };
  for (const key of keys) delete copy[key];
  return copy;
}

interface BlankedEntry {
  readonly key: RequiredEnvKey;
  readonly blank: string;
}

function envWithBlanks(
  entries: readonly BlankedEntry[],
): Record<string, string> {
  const copy: Record<string, string> = { ...validEnv };
  for (const { key, blank } of entries) copy[key] = blank;
  return copy;
}

function failure(source: EnvSource): EnvValidationError {
  try {
    parseEnv(source);
  } catch (error) {
    if (error instanceof EnvValidationError) return error;
    throw error;
  }
  throw new Error("expected parseEnv to throw");
}

/** Whether `message` names `name` as a whole word. Names are `[A-Z_]+`, so no escaping is needed. */
function mentions(message: string, name: RequiredEnvKey): boolean {
  return new RegExp(`\\b${name}\\b`).test(message);
}

function sorted(keys: readonly RequiredEnvKey[]): RequiredEnvKey[] {
  return [...keys].sort();
}

/** Asserts the error names exactly `expected` (sorted, unique) and carries no fixture value. */
function expectExactlyNamed(
  error: EnvValidationError,
  expected: readonly RequiredEnvKey[],
): void {
  expect(error).toBeInstanceOf(EnvValidationError);
  expect(error.variables).toEqual(expected);
  for (const key of REQUIRED_ENV_KEYS) {
    expect(mentions(error.message, key)).toBe(expected.includes(key));
  }
  for (const value of fixtureValues) {
    expect(error.message).not.toContain(value);
    for (const variable of error.variables) {
      expect(variable).not.toContain(value);
    }
  }
}

const requiredKey = fc.constantFrom(...REQUIRED_ENV_KEYS);

/** Any subset of the required keys, in declaration order (not sorted). */
const removedKeys = fc.subarray([...REQUIRED_ENV_KEYS]);

/** Empty or whitespace-only strings, including non-ASCII whitespace. */
const blank = fc.string({
  unit: fc.constantFrom(" ", "\t", "\n", "\r", "\u00A0"),
  maxLength: 4,
});

/** Distinct required keys, each with its own blank replacement. */
const blankedEntries = fc.uniqueArray(
  fc.record<BlankedEntry>({ key: requiredKey, blank }),
  { selector: (entry) => entry.key, maxLength: REQUIRED_ENV_KEYS.length },
);

/** A required key paired with a value its schema is guaranteed to reject. */
const malformed = fc.oneof(
  fc.record({
    key: fc.constantFrom<RequiredEnvKey>(
      "BETTER_AUTH_URL",
      "NEXT_PUBLIC_APP_URL",
    ),
    // `z.url()` needs a scheme, so nothing without ":" can parse.
    value: fc
      .string({ unit: "grapheme", maxLength: 24 })
      .filter((value) => !value.includes(":")),
  }),
  fc.record({
    key: fc.constant<RequiredEnvKey>("BETTER_AUTH_SECRET"),
    // ASCII only, so `.length` is under the 16 characters the schema demands.
    value: fc.string({ unit: "grapheme-ascii", maxLength: 15 }),
  }),
);

describe("F1-R1.3 Property 12: env validation lists exactly the offending variables", () => {
  it("uses a valid fixture whose values cannot hide inside a names-only message", () => {
    expect(() => parseEnv(validEnv)).not.toThrow();

    const allNames = failure({}).message;
    for (const value of fixtureValues) {
      expect(value.length).toBeGreaterThanOrEqual(8);
      expect(allNames).not.toContain(value);
    }
  });

  it("lists exactly the removed required keys, sorted, and never a value", () => {
    fc.assert(
      fc.property(removedKeys, (removed) => {
        const source = envWithout(removed);

        if (removed.length === 0) {
          const env = parseEnv(source);
          for (const key of REQUIRED_ENV_KEYS) {
            expect(env[key]).toBe(validEnv[key]);
          }
          return;
        }

        expectExactlyNamed(failure(source), sorted(removed));
      }),
      { numRuns: RUNS },
    );
  });

  it("treats blank required values as missing and lists exactly those keys", () => {
    fc.assert(
      fc.property(blankedEntries, (entries) => {
        const source = envWithBlanks(entries);

        if (entries.length === 0) {
          expect(() => parseEnv(source)).not.toThrow();
          return;
        }

        expectExactlyNamed(
          failure(source),
          sorted(entries.map((entry) => entry.key)),
        );
      }),
      { numRuns: RUNS },
    );
  });

  it("names only the malformed variable and never echoes its value", () => {
    fc.assert(
      fc.property(malformed, ({ key, value }) => {
        // The empty string is a substring of everything, and a value that
        // happens to occur inside the names-only message (say "URL" or "a")
        // cannot be told apart from a leak; skip those runs.
        const namesOnly = failure({ ...validEnv, [key]: undefined }).message;
        fc.pre(value !== "" && !namesOnly.includes(value));

        const error = failure({ ...validEnv, [key]: value });

        expect(error.variables).toEqual([key]);
        expect(error.message).not.toContain(value);
        for (const variable of error.variables) {
          expect(variable).not.toContain(value);
        }
      }),
      { numRuns: RUNS },
    );
  });
});
