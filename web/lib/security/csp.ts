/**
 * Content-Security-Policy for every HTML response (tech.md "Security";
 * design.md "`web/proxy.ts`"; requirement F1-R9.5 context).
 *
 * The policy is nonce-based: `proxy.ts` generates a fresh nonce per request,
 * puts it in `script-src`, and forwards it in the `x-nonce` request header so
 * Next.js stamps it on every script tag it emits. `'strict-dynamic'` then
 * lets those nonced scripts load the chunks they need without listing hosts.
 *
 * `CSP_DIRECTIVES` is plain data so later specs extend it without touching
 * the builder: spec 02 passes `extraDirectives` with LiveKit's `connect-src`
 * (signalling over `wss:`) and `media-src` (blob: for local recording).
 *
 * Runs in the Next.js proxy, so it only uses Web APIs (`crypto`, `btoa`)
 * that exist in both the Node.js and Edge runtimes.
 */

export type CspDirectiveName =
  | "default-src"
  | "script-src"
  | "style-src"
  | "img-src"
  | "connect-src"
  | "font-src"
  | "media-src"
  | "worker-src"
  | "object-src"
  | "frame-ancestors"
  | "form-action"
  | "base-uri";

/** Directive name to its source list. Absent directives fall back to `default-src`. */
export type CspDirectives = Partial<
  Record<CspDirectiveName, readonly string[]>
>;

/**
 * Serialization order: design.md's directives first, in its order, so the
 * production header starts with the design string verbatim; `object-src`
 * (added here) comes last. Directives missing from a table are skipped.
 */
export const CSP_DIRECTIVE_ORDER: readonly CspDirectiveName[] = [
  "default-src",
  "script-src",
  "style-src",
  "img-src",
  "connect-src",
  "font-src",
  "media-src",
  "worker-src",
  "frame-ancestors",
  "form-action",
  "base-uri",
  "object-src",
];

/**
 * The static part of the policy from design.md. `script-src` gains the
 * per-request nonce (inserted after `'self'`) in `buildContentSecurityPolicy`.
 *
 * - `style-src 'unsafe-inline'`: Next.js and Radix emit inline `style`
 *   attributes; styles cannot run code, so this is the accepted trade-off.
 * - `img-src https://lh3.googleusercontent.com`: Google profile pictures.
 * - `form-action https://accounts.google.com`: the OAuth redirect.
 * - `object-src 'none'`: no plugins, ever; kept in development too so the
 *   two policies differ only where dev tooling forces it.
 */
export const CSP_DIRECTIVES: Readonly<CspDirectives> = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'strict-dynamic'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "https://lh3.googleusercontent.com"],
  "connect-src": ["'self'"],
  "font-src": ["'self'"],
  "frame-ancestors": ["'none'"],
  "form-action": ["'self'", "https://accounts.google.com"],
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
};

/**
 * Sources the Next.js development server needs and production must never
 * have: React Refresh and source maps evaluate code (`'unsafe-eval'`), and
 * hot reloading talks to the dev server over a WebSocket (`ws:`).
 */
export const CSP_DEV_DIRECTIVES: Readonly<CspDirectives> = {
  "script-src": ["'unsafe-eval'"],
  "connect-src": ["ws:"],
};

/** Base64 or base64url; anything else could smuggle a `;` and add directives. */
const NONCE_PATTERN = /^[A-Za-z0-9+/=_-]+$/;

export interface BuildCspOptions {
  /** `true` outside production: adds `CSP_DEV_DIRECTIVES`, drops `upgrade-insecure-requests`. */
  dev: boolean;
  /** Sources appended per directive (spec 02: LiveKit `connect-src`, `media-src`). */
  extraDirectives?: CspDirectives;
}

/** 16 random bytes, base64 (24 characters). Fresh for every request. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Appends `extra` sources to `base` per directive, keeping order and dropping duplicates. */
export function mergeCspDirectives(
  base: Readonly<CspDirectives>,
  extra: Readonly<CspDirectives>,
): CspDirectives {
  const merged: CspDirectives = { ...base };
  for (const name of CSP_DIRECTIVE_ORDER) {
    const additions = extra[name];
    if (additions === undefined) continue;
    merged[name] = [...new Set([...(merged[name] ?? []), ...additions])];
  }
  return merged;
}

/** `name source source; name source` in `CSP_DIRECTIVE_ORDER`. Empty source lists are skipped. */
export function serializeCspDirectives(
  directives: Readonly<CspDirectives>,
): string {
  const parts: string[] = [];
  for (const name of CSP_DIRECTIVE_ORDER) {
    const sources = directives[name];
    if (sources === undefined || sources.length === 0) continue;
    parts.push(`${name} ${sources.join(" ")}`);
  }
  return parts.join("; ");
}

/**
 * The full header value for one request.
 *
 * Production (`dev: false`) yields exactly the design.md policy plus
 * `object-src 'none'` and `upgrade-insecure-requests`. Development adds
 * `'unsafe-eval'` and `ws:` and omits `upgrade-insecure-requests`, which
 * would break plain-http localhost in some browsers.
 *
 * @throws {Error} when `nonce` is not base64/base64url (defence against
 *   header injection; `generateNonce` always satisfies this).
 */
export function buildContentSecurityPolicy(
  nonce: string,
  options: BuildCspOptions,
): string {
  if (!NONCE_PATTERN.test(nonce)) {
    throw new Error("CSP nonce must be base64 or base64url");
  }

  let directives = mergeCspDirectives(
    CSP_DIRECTIVES,
    options.extraDirectives ?? {},
  );
  if (options.dev) {
    directives = mergeCspDirectives(directives, CSP_DEV_DIRECTIVES);
  }
  directives["script-src"] = withNonce(directives["script-src"] ?? [], nonce);

  const policy = serializeCspDirectives(directives);
  return options.dev ? policy : `${policy}; upgrade-insecure-requests`;
}

/** Inserts `'nonce-…'` right after a leading `'self'` so the output reads as in design.md. */
function withNonce(sources: readonly string[], nonce: string): string[] {
  const nonceSource = `'nonce-${nonce}'`;
  const [first, ...rest] = sources;
  return first === "'self'"
    ? [first, nonceSource, ...rest]
    : [nonceSource, ...sources];
}
