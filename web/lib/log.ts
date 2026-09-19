/**
 * Structured JSON-line logging (tech.md "Observability" and hard rule 10).
 *
 * Every entry is one JSON object per line: `level`, `time`, `event`, then
 * the caller's fields after `redact` has removed personal data. Request
 * handlers pass `requestId`, `userId`, `route`, `status` and `durationMs`.
 *
 * Log user ids and route names, never emails, names, passwords, tokens or
 * cookies. `redact` enforces that by key name as a safety net; it is not a
 * substitute for care at the call site.
 *
 * Works in the Node.js and Edge runtimes: the default sink writes through
 * `console`, which both provide and which Vercel's log drain captures.
 */

export type LogLevel = "info" | "warn" | "error";

export interface LogFields {
  requestId?: string;
  userId?: string;
  route?: string;
  status?: number;
  durationMs?: number;
  [key: string]: unknown;
}

export type LogSink = (level: LogLevel, line: string) => void;

/**
 * A key is sensitive when its lower-cased form *contains* one of these
 * words, so `accessToken`, `set-cookie`, `userEmail`, `passwordHash` and
 * `displayName` are all stripped, not only exact matches. This deliberately
 * over-redacts (`username`, `hostname` and `filename` are lost too); log the
 * user id instead of the username.
 */
const SENSITIVE_KEY_FRAGMENTS: readonly string[] = [
  "email",
  "name",
  "password",
  "token",
  "cookie",
];

/** Nesting deeper than this is replaced by "[truncated]". */
const MAX_DEPTH = 16;

/** Keys the logger owns; colliding caller fields are dropped. */
const RESERVED_KEYS: ReadonlySet<string> = new Set(["level", "time", "event"]);

/** Accepts `x-request-id` values that are short and printable; anything else is replaced. */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => lower.includes(fragment));
}

/**
 * Returns a deep copy of `value` with every sensitive key removed from plain
 * objects (recursively, including inside arrays). The input is not mutated.
 *
 * Conversions: `Date` becomes an ISO string, `bigint` a decimal string, and
 * `Error` becomes `{ name, message }` (plus `stack` outside production).
 * Error objects are returned as that fixed shape and are not key-filtered,
 * so `name` there is the error class, never a person's name. Circular
 * references become "[circular]".
 */
export function redact(value: Record<string, unknown>): Record<string, unknown>;
export function redact(value: unknown): unknown;
export function redact(value: unknown): unknown {
  return redactValue(value, 0, new WeakSet());
}

function redactValue(
  value: unknown,
  depth: number,
  ancestors: WeakSet<object>,
): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
  }
  if (value instanceof Error) return serializeError(value);
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (ancestors.has(value)) return "[circular]";

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item: unknown) =>
        redactValue(item, depth + 1, ancestors),
      );
    }
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (isSensitiveKey(key)) continue;
      out[key] = redactValue(item, depth + 1, ancestors);
    }
    return out;
  } finally {
    ancestors.delete(value);
  }
}

function serializeError(error: Error): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: error.name,
    message: error.message,
  };
  if (process.env.NODE_ENV !== "production" && error.stack) {
    out.stack = error.stack;
  }
  return out;
}

const defaultSink: LogSink = (level, line) => {
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

let sink: LogSink = defaultSink;

/** Replaces where log lines go (tests capture them); call with no argument to restore the default. */
export function setLogSink(next?: LogSink): void {
  sink = next ?? defaultSink;
}

function emit(level: LogLevel, event: string, fields?: LogFields): void {
  const entry: Record<string, unknown> = {
    level,
    time: new Date().toISOString(),
    event,
  };
  if (fields) {
    for (const [key, value] of Object.entries(redact(fields))) {
      if (!RESERVED_KEYS.has(key)) entry[key] = value;
    }
  }
  sink(level, JSON.stringify(entry));
}

export const log = {
  info(event: string, fields?: LogFields): void {
    emit("info", event, fields);
  },
  warn(event: string, fields?: LogFields): void {
    emit("warn", event, fields);
  },
  error(event: string, fields?: LogFields): void {
    emit("error", event, fields);
  },
};

/** The inbound `x-request-id` when it looks sane, otherwise a fresh UUID. */
export function getRequestId(headers: Headers): string {
  const incoming = headers.get("x-request-id");
  return incoming !== null && REQUEST_ID_PATTERN.test(incoming)
    ? incoming
    : crypto.randomUUID();
}
