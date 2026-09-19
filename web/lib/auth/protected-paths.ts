import type { NextRequest } from "next/server";

/**
 * Which paths need a signed-in user, and where to send visitors who lack
 * one (requirement F1-R9.5; design.md "`web/proxy.ts`").
 *
 * The `(app)` route group from structure.md: Home plus these prefixes.
 * Everything else (`(auth)` pages, `/join/[token]`, `/privacy`, `/terms`,
 * `/api/**`) is public at this layer; handlers enforce their own rules.
 *
 * `proxy.ts` uses `isProtectedPath` for the optimistic cookie check; pages
 * still call `requireUser()`, which validates the session in the database.
 */
export const PROTECTED_PATH_PREFIXES: readonly string[] = [
  "/sessions",
  "/dashboard",
  "/calendar",
  "/history",
  "/notifications",
  "/leaderboard",
  "/settings",
  "/admin",
];

export const SIGN_IN_PATH = "/sign-in";

/** Query parameter carrying the path to return to after sign-in. */
export const NEXT_PARAM = "next";

/**
 * True for `/` and for any path equal to a protected prefix or below it on
 * a segment boundary: `/sessions/abc` yes, `/sessionsx` no.
 */
export function isProtectedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Returns `candidate` when it is a same-origin relative path safe to embed
 * in `?next=` or to redirect to after sign-in, otherwise `null`.
 *
 * Accepts only paths starting with a single `/`: `//evil.example` would be
 * protocol-relative, `/\evil.example` is treated as `//` by browsers, and
 * anything with a scheme or without a leading slash is not a path here.
 * Control characters are rejected so the value survives header encoding.
 */
export function safeNextPath(candidate: string): string | null {
  if (!candidate.startsWith("/")) return null;
  if (candidate.startsWith("//") || candidate.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return null;
  return candidate;
}

/**
 * `/sign-in?next=<pathname+search>` on the request's origin. `next` is
 * omitted for Home (sign-in already lands there) and for any path
 * `safeNextPath` rejects.
 */
export function signInRedirectUrl(request: NextRequest): URL {
  const url = new URL(SIGN_IN_PATH, request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/") {
    const target = safeNextPath(`${pathname}${search}`);
    if (target !== null) url.searchParams.set(NEXT_PARAM, target);
  }
  return url;
}
