// F1-R9.5: a Visitor requesting an authenticated route is redirected to
// sign-in with the route in `next`; every page response carries the
// per-request Content-Security-Policy and `x-request-id`, and next.config.ts
// adds the static security headers. Calls `proxy()` directly with
// `NextRequest` objects; no database is needed.
import { tryToParsePath } from "next/dist/lib/try-to-parse-path";
import { NextRequest, type NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import nextConfig from "@/next.config";
import { config, proxy } from "@/proxy";
import { SECURITY_HEADERS } from "@/lib/security/headers";

const ORIGIN = "http://localhost:3000";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function request(pathAndQuery: string, headers?: HeadersInit): NextRequest {
  return new NextRequest(`${ORIGIN}${pathAndQuery}`, { headers });
}

/** The request headers `NextResponse.next({ request })` forwards to the route. */
function forwardedRequestHeaders(response: NextResponse): Headers {
  const forwarded = new Headers();
  const names = response.headers.get("x-middleware-override-headers") ?? "";
  for (const name of names.split(",").filter((n) => n !== "")) {
    const value = response.headers.get(`x-middleware-request-${name}`);
    if (value !== null) forwarded.set(name, value);
  }
  return forwarded;
}

function expectPassThrough(response: NextResponse): void {
  expect(response.status).toBe(200);
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("x-middleware-next")).toBe("1");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("F1-R9.5 unauthenticated (app) request", () => {
  it("redirects /sessions/1 to /sign-in?next=%2Fsessions%2F1 with 307", () => {
    const response = proxy(request("/sessions/1"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      `${ORIGIN}/sign-in?next=%2Fsessions%2F1`,
    );
    expect(response.headers.get("x-request-id")).toMatch(UUID_PATTERN);
  });

  it("keeps the query string in next", () => {
    const response = proxy(request("/sessions/1?tab=notes"));

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("next")).toBe("/sessions/1?tab=notes");
  });

  it("redirects Home to /sign-in without next", () => {
    const response = proxy(request("/"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/sign-in`);
  });

  it.each(["/dashboard", "/settings/profile", "/admin", "/sessions/1/room"])(
    "redirects %s",
    (path) => {
      const response = proxy(request(path));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        `${ORIGIN}/sign-in?next=${encodeURIComponent(path)}`,
      );
    },
  );

  it("redirects when only unrelated cookies are present", () => {
    const response = proxy(request("/dashboard", { cookie: "theme=paper" }));
    expect(response.status).toBe(307);
  });

  it("redirects when the session cookie is present but empty", () => {
    const response = proxy(
      request("/dashboard", { cookie: "better-auth.session_token=" }),
    );
    expect(response.status).toBe(307);
  });
});

describe("(app) request with a session cookie", () => {
  it("passes through with a nonce CSP, x-request-id, and forwarded x-nonce", () => {
    const response = proxy(
      request("/sessions/1", {
        cookie: "better-auth.session_token=abc",
        "x-request-id": "req-proxy-0001",
      }),
    );

    expectPassThrough(response);

    const csp = response.headers.get("content-security-policy");
    expect(csp).toContain("'nonce-");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self' https://accounts.google.com");
    expect(response.headers.get("x-request-id")).toBe("req-proxy-0001");

    const forwarded = forwardedRequestHeaders(response);
    const nonce = forwarded.get("x-nonce");
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(forwarded.get("content-security-policy")).toBe(csp);
    expect(forwarded.get("x-request-id")).toBe("req-proxy-0001");
    // Original headers are kept for the route handler.
    expect(forwarded.get("cookie")).toBe("better-auth.session_token=abc");
  });

  it("accepts the __Secure- prefixed cookie Better Auth sets in production", () => {
    const response = proxy(
      request("/dashboard", {
        cookie: "__Secure-better-auth.session_token=abc",
      }),
    );
    expectPassThrough(response);
  });

  it("replaces an unsafe inbound x-request-id with a UUID", () => {
    const response = proxy(
      request("/dashboard", {
        cookie: "better-auth.session_token=abc",
        "x-request-id": "not a valid id; with punctuation",
      }),
    );

    expect(response.headers.get("x-request-id")).toMatch(UUID_PATTERN);
    expect(forwardedRequestHeaders(response).get("x-request-id")).toBe(
      response.headers.get("x-request-id"),
    );
  });

  it("uses a fresh nonce for every request", () => {
    const headers = { cookie: "better-auth.session_token=abc" };
    const first = proxy(request("/dashboard", headers));
    const second = proxy(request("/dashboard", headers));

    expect(forwardedRequestHeaders(first).get("x-nonce")).not.toBe(
      forwardedRequestHeaders(second).get("x-nonce"),
    );
  });

  it("never sets a cookie or echoes the session token in response headers", () => {
    const response = proxy(
      request("/dashboard", {
        cookie: "better-auth.session_token=secret-token-value",
      }),
    );

    expect(response.headers.get("set-cookie")).toBeNull();
    for (const [name, value] of response.headers) {
      if (name === "x-middleware-request-cookie") continue; // the forwarded request, not the response
      expect(value, name).not.toContain("secret-token-value");
    }
  });
});

describe("public request without a cookie", () => {
  it.each(["/privacy", "/terms", "/sign-in", "/join/abc123", "/goodbye"])(
    "%s passes through with a CSP",
    (path) => {
      const response = proxy(request(path));

      expectPassThrough(response);
      expect(response.headers.get("content-security-policy")).toContain(
        "'nonce-",
      );
      expect(response.headers.get("x-request-id")).toMatch(UUID_PATTERN);
    },
  );
});

describe("CSP by environment", () => {
  it("outside production allows 'unsafe-eval' and ws: for the dev server", () => {
    vi.stubEnv("NODE_ENV", "development");
    const csp = proxy(request("/privacy")).headers.get(
      "content-security-policy",
    );

    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("in production has no 'unsafe-eval' and upgrades insecure requests", () => {
    vi.stubEnv("NODE_ENV", "production");
    const csp = proxy(request("/privacy")).headers.get(
      "content-security-policy",
    );

    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("ws:");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });
});

describe("proxy config.matcher", () => {
  const [matcher, ...others] = config.matcher;

  it("has one matcher that skips prefetches", () => {
    expect(others).toHaveLength(0);
    expect(matcher?.missing).toEqual([
      { type: "header", key: "next-router-prefetch" },
      { type: "header", key: "purpose", value: "prefetch" },
    ]);
  });

  it("compiles with Next's path parser and excludes API and static paths", () => {
    const { error, regexStr } = tryToParsePath(matcher?.source ?? "");
    expect(error).toBeUndefined();
    const pattern = new RegExp(regexStr ?? "(?!)");

    for (const included of ["/", "/sessions/1", "/privacy", "/join/abc"]) {
      expect(pattern.test(included), included).toBe(true);
    }
    for (const excluded of [
      "/api/health",
      "/api/auth/sign-in/email",
      "/_next/static/chunks/main.js",
      "/_next/image",
      "/favicon.ico",
      "/icons/icon-192.png",
      "/manifest.webmanifest",
      "/sw.js",
    ]) {
      expect(pattern.test(excluded), excluded).toBe(false);
    }
  });
});

describe("next.config.ts headers()", () => {
  it("applies the static security headers to every path", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");
    const rules = await nextConfig.headers?.();

    expect(rules).toEqual([{ source: "/(.*)", headers: SECURITY_HEADERS }]);
    const keys = rules?.[0]?.headers.map((header) => header.key);
    expect(keys).toEqual([
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "X-Frame-Options",
    ]);
  });
});
