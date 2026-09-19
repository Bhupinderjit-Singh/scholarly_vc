// F1-R9.5: a Visitor requesting an authenticated route is redirected to
// sign-in and returned to that route afterwards. These tests cover the
// path classification and the redirect URL; tests/api/proxy.test.ts covers
// the proxy end to end.
import fc from "fast-check";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  isProtectedPath,
  NEXT_PARAM,
  PROTECTED_PATH_PREFIXES,
  safeNextPath,
  signInRedirectUrl,
} from "@/lib/auth/protected-paths";

const ORIGIN = "http://localhost:3000";

function requestFor(pathAndQuery: string): NextRequest {
  return new NextRequest(`${ORIGIN}${pathAndQuery}`);
}

describe("PROTECTED_PATH_PREFIXES", () => {
  it("lists the (app) route group from structure.md", () => {
    expect(PROTECTED_PATH_PREFIXES).toEqual([
      "/sessions",
      "/dashboard",
      "/calendar",
      "/history",
      "/notifications",
      "/leaderboard",
      "/settings",
      "/admin",
    ]);
  });
});

describe("isProtectedPath", () => {
  it.each([
    ["/", true],
    ["/sessions", true],
    ["/sessions/1", true],
    ["/sessions/1/room", true],
    ["/sessions/new", true],
    ["/dashboard", true],
    ["/calendar", true],
    ["/history", true],
    ["/notifications", true],
    ["/leaderboard", true],
    ["/settings", true],
    ["/settings/profile", true],
    ["/admin", true],
    ["/sign-in", false],
    ["/sign-up", false],
    ["/check-email", false],
    ["/forgot-password", false],
    ["/reset-password", false],
    ["/verify-email", false],
    ["/verified", false],
    ["/goodbye", false],
    ["/privacy", false],
    ["/terms", false],
    ["/join/abc123", false],
    ["/api/health", false],
    ["/api/auth/sign-in", false],
    ["/settingsx", false],
    ["/sessionsx", false],
    ["/sessions-archive", false],
    ["/admin.php", false],
    ["//sessions", false],
    ["", false],
    ["sessions", false],
  ])("%s → %s", (pathname, expected) => {
    expect(isProtectedPath(pathname)).toBe(expected);
  });

  it("equals the reference predicate for any path string (property)", () => {
    const reference = (p: string): boolean =>
      p === "/" ||
      PROTECTED_PATH_PREFIXES.some(
        (prefix) => p === prefix || p.startsWith(`${prefix}/`),
      );

    const segment = fc.oneof(
      fc.constantFrom(
        "sessions",
        "dashboard",
        "settings",
        "admin",
        "sign-in",
        "api",
        "sessionsx",
        "",
        "1",
        "room",
        "..",
      ),
      fc.string({ maxLength: 12 }),
    );
    const path = fc.oneof(
      fc.string({ maxLength: 40 }),
      fc
        .array(segment, { maxLength: 4 })
        .map((segments) => `/${segments.join("/")}`),
      fc
        .constantFrom(...PROTECTED_PATH_PREFIXES)
        .chain((prefix) =>
          fc.string({ maxLength: 10 }).map((suffix) => `${prefix}${suffix}`),
        ),
    );

    fc.assert(
      fc.property(path, (p) => {
        expect(isProtectedPath(p)).toBe(reference(p));
      }),
      { numRuns: 500 },
    );
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/sessions/1", "/sessions/1"],
    ["/sessions/1?tab=notes", "/sessions/1?tab=notes"],
    ["/", "/"],
    ["/settings/profile#avatar", "/settings/profile#avatar"],
  ])("keeps a same-origin relative path %j", (candidate, expected) => {
    expect(safeNextPath(candidate)).toBe(expected);
  });

  it.each([
    "//evil.example/steal",
    "/\\evil.example",
    "/sessions/\\evil",
    "https://evil.example/",
    "javascript:alert(1)",
    "sessions/1",
    "",
    "/sessions/1\r\nSet-Cookie: x=y",
    "/sessions\u00001",
  ])("rejects %j", (candidate) => {
    expect(safeNextPath(candidate)).toBeNull();
  });

  it("never returns something that parses to another origin (property)", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), (candidate) => {
        const safe = safeNextPath(candidate);
        if (safe === null) return;
        const resolved = new URL(safe, ORIGIN);
        expect(resolved.origin).toBe(ORIGIN);
        expect(safe.startsWith("/")).toBe(true);
      }),
      { numRuns: 500 },
    );
  });
});

describe("signInRedirectUrl", () => {
  it("builds /sign-in?next=%2Fsessions%2F1 on the request origin", () => {
    const url = signInRedirectUrl(requestFor("/sessions/1"));
    expect(url.href).toBe(`${ORIGIN}/sign-in?next=%2Fsessions%2F1`);
    expect(url.searchParams.get(NEXT_PARAM)).toBe("/sessions/1");
  });

  it("keeps the query string of the original request in next", () => {
    const url = signInRedirectUrl(requestFor("/sessions/1?tab=notes&x=1"));
    expect(url.pathname).toBe("/sign-in");
    expect(url.searchParams.get(NEXT_PARAM)).toBe("/sessions/1?tab=notes&x=1");
  });

  it("omits next for Home", () => {
    const url = signInRedirectUrl(requestFor("/"));
    expect(url.href).toBe(`${ORIGIN}/sign-in`);
    expect(url.searchParams.has(NEXT_PARAM)).toBe(false);
  });

  it("omits next for Home even with a query string", () => {
    const url = signInRedirectUrl(requestFor("/?ref=email"));
    expect(url.href).toBe(`${ORIGIN}/sign-in`);
  });

  it("uses the origin of the request, not a fixed host", () => {
    const url = signInRedirectUrl(
      new NextRequest("https://scholarly.example/dashboard"),
    );
    expect(url.href).toBe(
      "https://scholarly.example/sign-in?next=%2Fdashboard",
    );
  });

  it("never embeds a protocol-relative or backslash path in next", () => {
    for (const path of ["//evil.example", "/\\evil.example", "/%5Cevil"]) {
      const url = signInRedirectUrl(new NextRequest(`${ORIGIN}${path}`));
      const next = url.searchParams.get(NEXT_PARAM);
      if (next === null) continue;
      expect(new URL(next, ORIGIN).origin).toBe(ORIGIN);
      expect(next.startsWith("//")).toBe(false);
    }
  });
});
