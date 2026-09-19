// tech.md "Security" and design.md "`web/proxy.ts`": the static headers set
// by next.config.ts and the per-request Content-Security-Policy built by
// lib/security/csp.ts. Context for requirement F1-R9.5 (proxy.ts).
import { describe, expect, it } from "vitest";

import {
  buildContentSecurityPolicy,
  CSP_DEV_DIRECTIVES,
  CSP_DIRECTIVES,
  generateNonce,
  mergeCspDirectives,
  serializeCspDirectives,
} from "@/lib/security/csp";
import { SECURITY_HEADERS } from "@/lib/security/headers";

/** The directive list from design.md, verbatim, with a fixed nonce. */
const DESIGN_POLICY =
  "default-src 'self'; " +
  "script-src 'self' 'nonce-abc' 'strict-dynamic'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: https://lh3.googleusercontent.com; " +
  "connect-src 'self'; " +
  "font-src 'self'; " +
  "frame-ancestors 'none'; " +
  "form-action 'self' https://accounts.google.com; " +
  "base-uri 'self'";

const DESIGN_DIRECTIVES = DESIGN_POLICY.split("; ");

describe("SECURITY_HEADERS", () => {
  it("has exactly the five static headers with the expected values", () => {
    expect(SECURITY_HEADERS).toEqual([
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value:
          "camera=(self), microphone=(self), geolocation=(), display-capture=()",
      },
      { key: "X-Frame-Options", value: "DENY" },
    ]);
  });

  it("allows camera and microphone for this origin only", () => {
    const policy = SECURITY_HEADERS.find(
      (header) => header.key === "Permissions-Policy",
    );
    expect(policy?.value).toContain("camera=(self)");
    expect(policy?.value).toContain("microphone=(self)");
    expect(policy?.value).not.toMatch(/camera=\(\*|camera=\(self [^)]/);
  });
});

describe("buildContentSecurityPolicy (production)", () => {
  const policy = buildContentSecurityPolicy("abc", { dev: false });
  const directives = policy.split("; ");

  it("starts with the design.md policy verbatim", () => {
    expect(policy.startsWith(DESIGN_POLICY)).toBe(true);
  });

  it.each(DESIGN_DIRECTIVES)("contains the directive %s", (directive) => {
    expect(directives).toContain(directive);
  });

  it("adds object-src 'none' and upgrade-insecure-requests", () => {
    expect(directives).toContain("object-src 'none'");
    expect(directives.at(-1)).toBe("upgrade-insecure-requests");
  });

  it("carries the nonce and never 'unsafe-eval' or ws:", () => {
    expect(policy).toContain("'nonce-abc'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain("ws:");
  });

  it("lists every directive exactly once", () => {
    const names = directives.map((directive) => directive.split(" ")[0]);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("buildContentSecurityPolicy (development)", () => {
  const policy = buildContentSecurityPolicy("abc", { dev: true });

  it("adds 'unsafe-eval' to script-src and ws: to connect-src", () => {
    expect(policy).toContain(
      "script-src 'self' 'nonce-abc' 'strict-dynamic' 'unsafe-eval'",
    );
    expect(policy).toContain("connect-src 'self' ws:");
  });

  it("keeps the nonce and object-src 'none', drops upgrade-insecure-requests", () => {
    expect(policy).toContain("'nonce-abc'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain("upgrade-insecure-requests");
  });

  it("differs from production only by the documented dev sources", () => {
    const prod = buildContentSecurityPolicy("abc", { dev: false });
    const withoutDevSources = policy
      .replace(" 'unsafe-eval'", "")
      .replace(" ws:", "");
    expect(`${withoutDevSources}; upgrade-insecure-requests`).toBe(prod);
    expect(Object.keys(CSP_DEV_DIRECTIVES).sort()).toEqual([
      "connect-src",
      "script-src",
    ]);
  });
});

describe("buildContentSecurityPolicy (extensions and safety)", () => {
  it("appends extra sources per directive so spec 02 can add LiveKit", () => {
    const policy = buildContentSecurityPolicy("abc", {
      dev: false,
      extraDirectives: {
        "connect-src": ["wss://livekit.example"],
        "media-src": ["'self'", "blob:"],
      },
    });
    expect(policy).toContain("connect-src 'self' wss://livekit.example");
    expect(policy).toContain("media-src 'self' blob:");
  });

  it("does not duplicate a source already present", () => {
    const merged = mergeCspDirectives(CSP_DIRECTIVES, {
      "connect-src": ["'self'", "wss://livekit.example"],
    });
    expect(merged["connect-src"]).toEqual(["'self'", "wss://livekit.example"]);
  });

  it("does not mutate the shared directive table", () => {
    const before = JSON.stringify(CSP_DIRECTIVES);
    buildContentSecurityPolicy("abc", {
      dev: true,
      extraDirectives: { "img-src": ["https://cdn.example"] },
    });
    expect(JSON.stringify(CSP_DIRECTIVES)).toBe(before);
  });

  it("skips empty source lists when serializing", () => {
    expect(
      serializeCspDirectives({ "default-src": ["'self'"], "img-src": [] }),
    ).toBe("default-src 'self'");
  });

  it.each(["abc; script-src *", "a b", "", "nonce with space"])(
    "rejects a nonce that could inject directives: %j",
    (nonce) => {
      expect(() => buildContentSecurityPolicy(nonce, { dev: false })).toThrow(
        /base64/,
      );
    },
  );
});

describe("generateNonce", () => {
  it("returns base64 of 16 bytes (24 characters, at least 22 of payload)", () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(nonce.length).toBeGreaterThanOrEqual(22);
    expect(Buffer.from(nonce, "base64")).toHaveLength(16);
  });

  it("differs between calls", () => {
    const nonces = new Set(Array.from({ length: 50 }, () => generateNonce()));
    expect(nonces.size).toBe(50);
  });

  it("is accepted by buildContentSecurityPolicy", () => {
    const nonce = generateNonce();
    expect(buildContentSecurityPolicy(nonce, { dev: false })).toContain(
      `'nonce-${nonce}'`,
    );
  });
});
