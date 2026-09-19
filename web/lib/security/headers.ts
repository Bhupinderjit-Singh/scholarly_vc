/**
 * Static security headers applied to every response by `next.config.ts`
 * `headers()` (tech.md "Security"; design.md "`web/proxy.ts`").
 *
 * These never vary per request, so they belong in the config rather than
 * the proxy. The per-request `Content-Security-Policy` lives in `proxy.ts`
 * (see `lib/security/csp.ts`).
 *
 * `next.config.ts` imports this module while Next.js loads the config, so it
 * must stay free of side effects and of imports that read the environment.
 */

export interface HeaderEntry {
  key: string;
  value: string;
}

/** Two years, subdomains included, eligible for browser preload lists. */
export const STRICT_TRANSPORT_SECURITY =
  "max-age=63072000; includeSubDomains; preload";

/**
 * Camera and microphone for this origin only (the study room); everything
 * else off. `display-capture=()` reinforces the "no screen sharing" scope.
 */
export const PERMISSIONS_POLICY =
  "camera=(self), microphone=(self), geolocation=(), display-capture=()";

export const SECURITY_HEADERS: ReadonlyArray<HeaderEntry> = [
  { key: "Strict-Transport-Security", value: STRICT_TRANSPORT_SECURITY },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
  // Belt and braces with the CSP's `frame-ancestors 'none'` for old browsers.
  { key: "X-Frame-Options", value: "DENY" },
];
