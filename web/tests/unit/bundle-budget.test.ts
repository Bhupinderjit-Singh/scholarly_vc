// F1-R2.10: the bundle-budget script sums the gzipped JavaScript of every
// route from the Next.js build output and fails only when a route other than
// the session room exceeds the budget. These tests drive the pure functions in
// scripts/bundle-budget/lib.mjs with synthetic manifests and an in-memory
// file system; the CLI wrapper is exercised by `npm run check:bundle` in CI.
import { gzipSync } from "node:zlib";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_BUDGET_KB,
  DEFAULT_EXEMPT_PATTERN,
  evaluateBudget,
  formatKb,
  formatReport,
  isJavaScriptChunk,
  KIB,
  normalizeChunkPath,
  parseClientReferenceManifest,
  routeFromEntry,
  routesFromManifests,
  sumGzipped,
  type BuildManifest,
  type RouteManifest,
  type RouteSize,
} from "@/scripts/bundle-budget/lib.mjs";

const encoder = new TextEncoder();

/** An in-memory dist dir: path → content of `length` bytes. */
function memoryFs(sizes: Record<string, number>): (file: string) => Uint8Array {
  return (file) => {
    const size = sizes[file];
    if (size === undefined) throw new Error(`ENOENT: ${file}`);
    return new Uint8Array(size);
  };
}

/** Counts bytes without compressing, so sums are readable in assertions. */
const identity = (data: Uint8Array): Uint8Array => data;

const buildManifest: BuildManifest = {
  rootMainFiles: [
    "static/chunks/runtime.js",
    "static/chunks/react.js",
    "static/chunks/next.js",
  ],
  polyfillFiles: ["static/chunks/polyfills.js"],
};

// Two pages under the `(app)` group sharing the root and group layouts, plus
// a route handler. The dashboard page also has its own client component.
const turbopackManifests: RouteManifest[] = [
  {
    entry: "/(app)/page",
    manifest: {
      entryJSFiles: {
        "[project]/app/layout": [
          "static/chunks/layout.js",
          "static/chunks/react.js",
        ],
        "[project]/app/(app)/layout": [
          "static/chunks/shell.js",
          "static/chunks/shell.css",
        ],
      },
    },
  },
  {
    entry: "/(app)/dashboard/page",
    manifest: {
      entryJSFiles: {
        "[project]/app/layout": [
          "static/chunks/layout.js",
          "static/chunks/react.js",
        ],
        "[project]/app/(app)/layout": [
          "static/chunks/shell.js",
          "static/chunks/shell.css",
        ],
        "[project]/app/(app)/dashboard/page": [
          "static/chunks/charts.js",
          "static/chunks/shell.js",
        ],
      },
    },
  },
  {
    entry: "/api/health/route",
    manifest: { entryJSFiles: {} },
  },
];

const appPathRoutes = {
  "/(app)/page": "/",
  "/(app)/dashboard/page": "/dashboard",
  "/api/health/route": "/api/health",
};

describe("F1-R2.10 parseClientReferenceManifest", () => {
  it("parses the Turbopack layout (separate assignment lines)", () => {
    const source = [
      "globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};",
      'globalThis.__RSC_MANIFEST["/(app)/page"] = {"clientModules":{},"entryJSFiles":{"[project]/app/layout":["static/chunks/a.js"]}};',
      "",
    ].join("\n");
    expect(parseClientReferenceManifest(source)).toEqual({
      entry: "/(app)/page",
      manifest: {
        clientModules: {},
        entryJSFiles: { "[project]/app/layout": ["static/chunks/a.js"] },
      },
    });
  });

  it("parses the webpack layout (one compact line, no entryJSFiles)", () => {
    const source =
      'globalThis.__RSC_MANIFEST=(globalThis.__RSC_MANIFEST||{});globalThis.__RSC_MANIFEST["/page"]={"clientModules":{"m":{"id":1,"chunks":["/_next/static/chunks/a.js"]}}}';
    expect(parseClientReferenceManifest(source)).toEqual({
      entry: "/page",
      manifest: {
        clientModules: { m: { id: 1, chunks: ["/_next/static/chunks/a.js"] } },
      },
    });
  });

  it("rejects anything that is not a manifest assignment", () => {
    expect(() => parseClientReferenceManifest("export default {}")).toThrow(
      /Unrecognised client reference manifest/,
    );
    expect(() =>
      parseClientReferenceManifest('globalThis.__RSC_MANIFEST["/page"] = [];'),
    ).toThrow(/Unrecognised client reference manifest/);
  });
});

describe("F1-R2.10 route naming and chunk paths", () => {
  it("derives the URL path from an entry name", () => {
    expect(routeFromEntry("/page")).toBe("/");
    expect(routeFromEntry("/(app)/page")).toBe("/");
    expect(routeFromEntry("/(app)/sessions/[id]/room/page")).toBe(
      "/sessions/[id]/room",
    );
    expect(routeFromEntry("/(app)/@modal/photo/[id]/page")).toBe("/photo/[id]");
    expect(routeFromEntry("/_not-found/page")).toBe("/_not-found");
    expect(routeFromEntry("/api/health/route")).toBe("/api/health");
  });

  it("normalises chunk references to dist-relative paths", () => {
    expect(normalizeChunkPath("static/chunks/a.js")).toBe("static/chunks/a.js");
    expect(normalizeChunkPath("/_next/static/chunks/a.js")).toBe(
      "static/chunks/a.js",
    );
    expect(normalizeChunkPath("/static/chunks/a.js")).toBe(
      "static/chunks/a.js",
    );
  });

  it("counts .js and .mjs files only", () => {
    expect(isJavaScriptChunk("static/chunks/a.js")).toBe(true);
    expect(isJavaScriptChunk("static/chunks/a.mjs")).toBe(true);
    expect(isJavaScriptChunk("static/chunks/a.css")).toBe(false);
    expect(isJavaScriptChunk("static/chunks/a.js.map")).toBe(false);
  });
});

describe("F1-R2.10 routesFromManifests", () => {
  it("unions bootstrap and segment chunks per route, deduplicated, JS only", () => {
    const routes = routesFromManifests(turbopackManifests, buildManifest, {
      appPathRoutes,
    });
    expect(routes).toEqual([
      {
        entry: "/(app)/page",
        route: "/",
        files: [
          "static/chunks/layout.js",
          "static/chunks/next.js",
          "static/chunks/react.js",
          "static/chunks/runtime.js",
          "static/chunks/shell.js",
        ],
      },
      {
        entry: "/(app)/dashboard/page",
        route: "/dashboard",
        files: [
          "static/chunks/charts.js",
          "static/chunks/layout.js",
          "static/chunks/next.js",
          "static/chunks/react.js",
          "static/chunks/runtime.js",
          "static/chunks/shell.js",
        ],
      },
    ]);
  });

  it("skips route handlers, which ship no HTML", () => {
    const routes = routesFromManifests(turbopackManifests, buildManifest);
    expect(routes.map((route) => route.entry)).not.toContain(
      "/api/health/route",
    );
  });

  it("falls back to deriving the route when the routes manifest lacks the entry", () => {
    const routes = routesFromManifests(turbopackManifests, buildManifest);
    expect(routes.map((route) => route.route)).toEqual(["/", "/dashboard"]);
  });

  it("excludes nomodule polyfills unless asked to include them", () => {
    const [home] = routesFromManifests(turbopackManifests, buildManifest);
    expect(home?.files).not.toContain("static/chunks/polyfills.js");
    const [homeWithPolyfills] = routesFromManifests(
      turbopackManifests,
      buildManifest,
      { includePolyfills: true },
    );
    expect(homeWithPolyfills?.files).toContain("static/chunks/polyfills.js");
  });

  it("prefers rootMainFilesTree[entry] over rootMainFiles when present", () => {
    const routes = routesFromManifests(turbopackManifests, {
      ...buildManifest,
      rootMainFilesTree: { "/(app)/page": ["static/chunks/slim-runtime.js"] },
    });
    expect(routes[0]?.files).toEqual([
      "static/chunks/layout.js",
      "static/chunks/react.js",
      "static/chunks/shell.js",
      "static/chunks/slim-runtime.js",
    ]);
    expect(routes[1]?.files).toContain("static/chunks/runtime.js");
  });

  it("falls back to clientModules chunks for webpack manifests without entryJSFiles", () => {
    const webpackManifests: RouteManifest[] = [
      {
        entry: "/page",
        manifest: {
          clientModules: {
            "app/layout.tsx": {
              chunks: ["/_next/static/chunks/app/layout.js"],
            },
            "components/x.tsx": {
              chunks: [
                "/_next/static/chunks/app/layout.js",
                "/_next/static/chunks/578.js",
              ],
            },
          },
        },
      },
    ];
    expect(routesFromManifests(webpackManifests, buildManifest)).toEqual([
      {
        entry: "/page",
        route: "/",
        files: [
          "static/chunks/578.js",
          "static/chunks/app/layout.js",
          "static/chunks/next.js",
          "static/chunks/react.js",
          "static/chunks/runtime.js",
        ],
      },
    ]);
  });
});

describe("F1-R2.10 sumGzipped", () => {
  it("reads each distinct file once and sums the compressed sizes", () => {
    const readFile = memoryFs({
      "static/chunks/a.js": 1000,
      "static/chunks/b.js": 500,
    });
    const result = sumGzipped(
      ["static/chunks/a.js", "static/chunks/b.js", "static/chunks/a.js"],
      readFile,
      identity,
    );
    expect(result.gzippedBytes).toBe(1500);
    expect(result.files).toEqual([
      { path: "static/chunks/a.js", rawBytes: 1000, gzippedBytes: 1000 },
      { path: "static/chunks/b.js", rawBytes: 500, gzippedBytes: 500 },
    ]);
  });

  it("gzips at zlib's default level by default", () => {
    const script = encoder.encode(
      "export const greeting = 'hello';\n".repeat(200),
    );
    const result = sumGzipped(["static/chunks/a.js"], () => script);
    expect(result.gzippedBytes).toBe(gzipSync(script).byteLength);
    expect(result.gzippedBytes).toBeLessThan(script.byteLength);
    expect(result.files[0]?.rawBytes).toBe(script.byteLength);
  });

  it("surfaces a missing chunk instead of counting it as zero", () => {
    expect(() =>
      sumGzipped(["static/chunks/missing.js"], memoryFs({}), identity),
    ).toThrow(/missing\.js/);
  });
});

describe("F1-R2.10 evaluateBudget", () => {
  const budgetBytes = 200 * KIB;
  const size = (
    entry: string,
    route: string,
    gzippedBytes: number,
  ): RouteSize => ({ entry, route, gzippedBytes, files: [] });

  it("passes when every route is within the budget", () => {
    const result = evaluateBudget(
      [
        size("/(app)/page", "/", 150 * KIB),
        size("/privacy/page", "/privacy", 90 * KIB),
      ],
      budgetBytes,
    );
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.routes.map((route) => route.status)).toEqual(["ok", "ok"]);
  });

  it("fails a route strictly over the budget and lists it as a violation", () => {
    const result = evaluateBudget(
      [
        size("/(app)/page", "/", 150 * KIB),
        size("/(app)/dashboard/page", "/dashboard", budgetBytes + 1),
      ],
      budgetBytes,
    );
    expect(result.ok).toBe(false);
    expect(result.violations.map((route) => route.route)).toEqual([
      "/dashboard",
    ]);
    expect(result.violations[0]?.overBytes).toBe(1);
  });

  it("passes a route exactly at the budget", () => {
    const result = evaluateBudget(
      [size("/(app)/page", "/", budgetBytes)],
      budgetBytes,
    );
    expect(result.ok).toBe(true);
    expect(result.routes[0]).toMatchObject({ status: "ok", overBytes: 0 });
  });

  it("exempts the session room route but still reports it", () => {
    const result = evaluateBudget(
      [
        size(
          "/(app)/sessions/[id]/room/page",
          "/sessions/[id]/room",
          900 * KIB,
        ),
        size("/(app)/sessions/[id]/page", "/sessions/[id]", 900 * KIB),
      ],
      budgetBytes,
    );
    expect(result.ok).toBe(false);
    expect(result.routes.map((route) => [route.route, route.status])).toEqual([
      ["/sessions/[id]", "over"],
      ["/sessions/[id]/room", "exempt"],
    ]);
    expect(result.violations.map((route) => route.route)).toEqual([
      "/sessions/[id]",
    ]);
  });

  it("sorts routes by gzipped size, largest first", () => {
    const result = evaluateBudget(
      [
        size("/a/page", "/a", 10),
        size("/b/page", "/b", 30),
        size("/c/page", "/c", 20),
      ],
      budgetBytes,
    );
    expect(result.routes.map((route) => route.route)).toEqual([
      "/b",
      "/c",
      "/a",
    ]);
  });

  it("uses the default 200 KB budget and room exemption from tech.md", () => {
    expect(DEFAULT_BUDGET_KB).toBe(200);
    expect(KIB).toBe(1024);
    expect(DEFAULT_EXEMPT_PATTERN.test("/(app)/sessions/[id]/room/page")).toBe(
      true,
    );
    expect(DEFAULT_EXEMPT_PATTERN.test("/(app)/sessions/[id]/page")).toBe(
      false,
    );
  });

  it("is over budget exactly when some non-exempt route is strictly larger", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            room: fc.boolean(),
            gzippedBytes: fc.integer({ min: 0, max: 400 * KIB }),
          }),
          { maxLength: 12 },
        ),
        fc.integer({ min: 1, max: 300 * KIB }),
        (routes, budget) => {
          const sizes = routes.map((route, index) =>
            size(
              route.room
                ? `/(app)/sessions/[id]/room/page`
                : `/route-${index}/page`,
              route.room ? "/sessions/[id]/room" : `/route-${index}`,
              route.gzippedBytes,
            ),
          );
          const result = evaluateBudget(sizes, budget);
          const expectedOk = routes.every(
            (route) => route.room || route.gzippedBytes <= budget,
          );
          expect(result.ok).toBe(expectedOk);
          expect(result.routes).toHaveLength(sizes.length);
          expect(
            result.violations.every(
              (route) => route.status === "over" && route.gzippedBytes > budget,
            ),
          ).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("F1-R2.10 report formatting", () => {
  it("formats bytes as KB with one decimal", () => {
    expect(formatKb(0)).toBe("0.0 KB");
    expect(formatKb(200 * KIB)).toBe("200.0 KB");
    expect(formatKb(145_408)).toBe("142.0 KB");
  });

  it("prints route, gzipped size and status, largest first", () => {
    const result = evaluateBudget(
      [
        {
          entry: "/(app)/page",
          route: "/",
          gzippedBytes: 142 * KIB,
          files: [],
        },
        {
          entry: "/(app)/dashboard/page",
          route: "/dashboard",
          gzippedBytes: 231 * KIB,
          files: [],
        },
        {
          entry: "/(app)/sessions/[id]/room/page",
          route: "/sessions/[id]/room",
          gzippedBytes: 480 * KIB,
          files: [],
        },
      ],
      200 * KIB,
    );
    expect(formatReport(result).split("\n")).toEqual([
      "Route                Gzipped JS  Status",
      "-------------------  ----------  -------------------",
      "/sessions/[id]/room    480.0 KB  exempt (room route)",
      "/dashboard             231.0 KB  OVER by 31.0 KB",
      "/                      142.0 KB  ok",
    ]);
  });
});
