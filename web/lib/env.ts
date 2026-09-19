import { z } from "zod";

/**
 * Validated server environment (tech.md "Environment variables" and hard
 * rule 6; requirement F1-R1.3).
 *
 * `parseEnv` is pure: it validates any record and returns the typed
 * environment or throws `EnvValidationError`, whose message and `variables`
 * list carry only variable names, never values. `getEnv()` parses
 * `process.env` once and caches the result; `instrumentation.ts` calls it at
 * server start so an invalid configuration prevents the server from starting.
 *
 * Nothing here reads `process.env` at import time, so importing this module
 * in tests or during `next build` (which has no `.env`) is safe.
 *
 * Server-only: this module describes secrets. Never import it from client
 * components; the browser only receives `NEXT_PUBLIC_*` values.
 */

/** Variables this spec requires. Later specs tighten their own (see the schema). */
export const REQUIRED_ENV_KEYS = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "NEXT_PUBLIC_APP_URL",
] as const;

export type RequiredEnvKey = (typeof REQUIRED_ENV_KEYS)[number];

/** Comma-separated list, trimmed, lower-cased, empty entries dropped, duplicates removed. */
export function parseAdminEmails(value: string): string[] {
  const emails = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  return [...new Set(emails)];
}

const nonEmpty = z.string().min(1);
/** Only `true` / `false` (any case) are accepted; `1`, `yes`, `on` are malformed. */
const boolString = z.stringbool({
  truthy: ["true"],
  falsy: ["false"],
  case: "insensitive",
});
const positiveInt = z.coerce.number().int().positive();

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Required by this spec.
  DATABASE_URL: nonEmpty, // Neon pooled URLs vary; only presence is checked.
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.url(),
  GOOGLE_CLIENT_ID: nonEmpty,
  GOOGLE_CLIENT_SECRET: nonEmpty,
  RESEND_API_KEY: nonEmpty,
  EMAIL_FROM: nonEmpty, // bare address or `Name <address>`
  NEXT_PUBLIC_APP_URL: z.url(),

  // Defaults (tech.md).
  ADMIN_EMAILS: z.string().default("").transform(parseAdminEmails),
  REGISTRATION_OPEN: boolString.default(true),
  EMAIL_TRANSPORT: z.enum(["resend", "capture"]).default("resend"),
  E2E_TEST_MODE: boolString.default(false),

  // Owned by later specs or by tooling; optional until those specs tighten them.
  DATABASE_URL_TEST: nonEmpty.optional(),
  LIVEKIT_URL: nonEmpty.optional(),
  LIVEKIT_API_KEY: nonEmpty.optional(),
  LIVEKIT_API_SECRET: nonEmpty.optional(),
  R2_ACCOUNT_ID: nonEmpty.optional(),
  R2_ACCESS_KEY_ID: nonEmpty.optional(),
  R2_SECRET_ACCESS_KEY: nonEmpty.optional(),
  R2_BUCKET: nonEmpty.optional(),
  VAPID_PUBLIC_KEY: nonEmpty.optional(),
  VAPID_PRIVATE_KEY: nonEmpty.optional(),
  VAPID_SUBJECT: nonEmpty.optional(),
  CRON_SECRET: nonEmpty.optional(),
  WORKER_TRIGGER_URL: z.url().optional(),
  WORKER_SHARED_SECRET: nonEmpty.optional(),
  MONTHLY_MINUTES_PER_USER: positiveInt.default(1500),
  MONTHLY_MINUTES_GLOBAL: positiveInt.default(4500),
  ANALYSIS_HOURS_PER_USER: positiveInt.default(60),
  ANALYSIS_HOURS_GLOBAL: positiveInt.default(400),
});

export type Env = z.output<typeof serverEnvSchema>;

export type EnvSource = Readonly<Record<string, string | undefined>>;

/**
 * Thrown when the environment is missing or malformed. `message` and
 * `variables` name the offending variables and nothing else; the Zod error
 * is intentionally not attached because it can describe received input.
 */
export class EnvValidationError extends Error {
  readonly variables: readonly string[];

  constructor(variables: readonly string[]) {
    super(`Invalid environment variables: ${variables.join(", ")}`);
    this.name = "EnvValidationError";
    this.variables = variables;
  }
}

/** `.env` files and hosting dashboards often yield `""` for unset variables; treat those as absent. */
function withoutEmptyValues(
  source: EnvSource,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(source)) {
    out[key] =
      typeof value === "string" && value.trim() === "" ? undefined : value;
  }
  return out;
}

function offendingVariables(
  issues: ReadonlyArray<{ readonly path: ReadonlyArray<PropertyKey> }>,
): string[] {
  const names = new Set<string>();
  for (const issue of issues) {
    const head = issue.path[0];
    if (typeof head === "string") names.add(head);
  }
  return [...names].sort();
}

/** Validates `source` without touching `process.env`. Throws `EnvValidationError` on failure. */
export function parseEnv(source: EnvSource): Env {
  const result = serverEnvSchema.safeParse(withoutEmptyValues(source));
  if (!result.success) {
    throw new EnvValidationError(offendingVariables(result.error.issues));
  }
  return result.data;
}

let cached: Env | undefined;

/** The validated `process.env`, parsed on first use and cached for the process lifetime. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Test-only: forget the cached environment so the next `getEnv()` re-reads `process.env`. */
export function resetEnvCache(): void {
  cached = undefined;
}
