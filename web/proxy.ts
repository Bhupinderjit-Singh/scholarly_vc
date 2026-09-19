import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { isProtectedPath, signInRedirectUrl } from "@/lib/auth/protected-paths";
import { getRequestId } from "@/lib/log";
import { buildContentSecurityPolicy, generateNonce } from "@/lib/security/csp";

/**
 * Request proxy (design.md "`web/proxy.ts`"; requirement F1-R9.5; tech.md
 * "Security" and hard rules 7 and 10).
 *
 * Runs before every page request (see `config.matcher`) and does three things:
 *
 * 1. Generates a per-request CSP nonce and sets `Content-Security-Policy`.
 *    The header is set on the *forwarded request* as well as on the
 *    response: Next.js reads the nonce from the request's CSP header and
 *    stamps it on every script tag it renders; `x-nonce` lets our own
 *    components (`headers().get("x-nonce")`) do the same.
 * 2. Adds `x-request-id` (inbound value when sane, else a UUID) to the
 *    forwarded request and to the response, so structured logs and the
 *    client can be correlated.
 * 3. Optimistically redirects `(app)` paths without a session cookie to
 *    `/sign-in?next=<path>`. The cookie is only checked for presence, never
 *    validated here; pages call `requireUser()` for the real check.
 *
 * Next.js 16 note (verified against the installed `next@16.3.5`):
 * `middleware.ts` was renamed to `proxy.ts` with a named `proxy` export, and
 * the proxy always runs on the Node.js runtime. A `runtime` segment export
 * in this file is a build error (E1031), so none is declared. Everything
 * used here (`crypto`, `btoa`, `Headers`) is Web-standard anyway.
 *
 * Better Auth cookie name: `getSessionCookie` parses the `cookie` header
 * and looks for `__Secure-better-auth.session_token` (production, where
 * Better Auth adds the `__Secure-` prefix) before `better-auth.session_token`
 * (development), returning `null` when neither is present or the value is
 * empty. It needs no configuration as long as `lib/auth/auth.ts` keeps the
 * default `cookiePrefix`; pass `{ cookiePrefix }` here if that ever changes.
 *
 * Nothing is logged here: the proxy sees cookies and URLs, and a log line
 * would add latency to every request.
 */
export function proxy(request: NextRequest): NextResponse {
  const requestId = getRequestId(request.headers);

  if (
    isProtectedPath(request.nextUrl.pathname) &&
    getSessionCookie(request) === null
  ) {
    const response = NextResponse.redirect(signInRedirectUrl(request), 307);
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const nonce = generateNonce();
  const csp = buildContentSecurityPolicy(nonce, {
    dev: process.env.NODE_ENV !== "production",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-request-id", requestId);
  return response;
}

/**
 * Everything except:
 *
 * - `api/**`: Better Auth sets its own headers on `/api/auth/*`, JSON routes
 *   such as `/api/health` must not carry a CSP or an auth redirect, and
 *   webhooks and cron calls never have a session cookie.
 * - Next's static assets and image optimizer, the favicon, the PWA icons,
 *   the web manifest and the service worker: static files, no HTML.
 *
 * Prefetches (`next-router-prefetch` or `purpose: prefetch`) are skipped so
 * hovering a link never triggers a redirect; the real navigation is checked.
 *
 * The exclusions are prefixes, as in Next's documented example: `/api` also
 * excludes `/apix`. No such route exists.
 */
export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
