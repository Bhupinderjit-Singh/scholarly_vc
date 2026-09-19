// @ts-check
/**
 * Pure logic for the JavaScript bundle budget (spec 01-foundation-auth, task
 * 2.4; requirement F1-R2.10; tech.md "Performance budgets": at most 200 KB of
 * gzipped JavaScript on every route except the session room route).
 *
 * Nothing here touches the file system. `scripts/check-bundle-budget.mjs`
 * reads the build output and feeds it in; `tests/unit/bundle-budget.test.ts`
 * drives these functions with synthetic manifests.
 *
 * ## Confirmed build output (Next.js 16.3.5, `next build`, Turbopack default)
 *
 * The design assumed a webpack-era `.next/app-build-manifest.json`
 * (`{ pages: { "/page": [chunks], "/layout": [chunks] } }`). Next.js 16 no
 * longer writes that file with either bundler. The equivalent data lives in:
 *
 * - `.next/build-manifest.json`
 *   ```
 *   { "pages": { "/_app": [] },
 *     "polyfillFiles": ["static/chunks/<hash>.js"],       // <script nomodule>
 *     "rootMainFiles": ["static/chunks/<hash>.js", ...],  // React + Next runtime
 *     "rootMainFilesTree": {},                            // optional per-entry override
 *     "lowPriorityFiles": [...], "chunkLoadingGlobal": "TURBOPACK" }
 *   ```
 *   `rootMainFiles` (or `rootMainFilesTree[entry]` when present) are the
 *   bootstrap scripts every HTML page loads (`server/app-render/required-scripts.js`).
 * - `.next/app-path-routes-manifest.json`
 *   `{ "/page": "/", "/(app)/dashboard/page": "/dashboard", "/api/health/route": "/api/health" }`
 *   maps entry names to URL paths.
 * - `.next/server/app/<entry>_client-reference-manifest.js`, one per page and
 *   route handler, a JS assignment rather than JSON:
 *   ```
 *   globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};
 *   globalThis.__RSC_MANIFEST["/page"] = { "moduleLoading": ..., "clientModules": {...},
 *     "ssrModuleMapping": ..., "rscModuleMapping": ...,
 *     "entryCSSFiles": { "[project]/app/layout": [{ "path": "static/chunks/<hash>.css", "inlined": false }] },
 *     "entryJSFiles":  { "[project]/app/layout": ["static/chunks/<hash>.js", ...],
 *                        "[project]/app/(app)/page": [...] } };
 *   ```
 *   `entryJSFiles` lists, per segment (layouts, templates, page, error and
 *   not-found boundaries), the client chunks the server emits as `<script>`
 *   tags for that route (`server/app-render/get-css-inlined-link-tags.js`).
 *   Under `next build --webpack` the same file is one compact line, has no
 *   `entryJSFiles`, and `clientModules[*].chunks` use a `/_next/` prefix.
 *
 * ## Measurement rules
 *
 * - Route JS = `rootMainFiles` ∪ every `entryJSFiles` list of the route's
 *   manifest, deduplicated, `.js` files only (CSS is listed alongside).
 * - Polyfills are excluded by default: Next renders them with `nomodule`, so
 *   browsers that support ES modules (every browser Next 16 supports) never
 *   download them. `includePolyfills` adds them back for a conservative number.
 * - Sizes are gzip at zlib's default level (6), which is what CDNs and
 *   `next start` use. Level 9 reports a few percent less than users receive.
 * - 1 KB = 1024 bytes, so the budget is 200 × 1024 = 204,800 bytes. A route
 *   exactly at the budget passes; only strictly larger fails.
 * - The exemption is matched against the entry name, so the room page
 *   `/(app)/sessions/[id]/room/page` matches `DEFAULT_EXEMPT_PATTERN`.
 */
import { gzipSync } from "node:zlib";

/** Budget per route in KB (tech.md, F1-R2.10). */
export const DEFAULT_BUDGET_KB = 200;

/** Bytes per KB used for the budget and for display. */
export const KIB = 1024;

/**
 * Entry names of the session room route (`/sessions/[id]/room`), the one route
 * allowed to exceed the budget because it carries the LiveKit client.
 */
export const DEFAULT_EXEMPT_PATTERN = /\/sessions\/\[id\]\/room\//;

/**
 * The fields of `.next/build-manifest.json` this module reads.
 * @typedef {object} BuildManifest
 * @property {string[]} rootMainFiles Bootstrap scripts loaded by every page.
 * @property {string[]} [polyfillFiles] `<script nomodule>` polyfills.
 * @property {Record<string, string[]>} [rootMainFilesTree] Per-entry override of `rootMainFiles`.
 */

/**
 * The fields of one `globalThis.__RSC_MANIFEST[entry]` object this module reads.
 * @typedef {object} ClientReferenceManifest
 * @property {Record<string, string[]>} [entryJSFiles] Client chunks per segment (Turbopack).
 * @property {Record<string, { chunks?: string[] }>} [clientModules] Client module → chunks (both bundlers).
 */

/**
 * One parsed `<entry>_client-reference-manifest.js` file.
 * @typedef {object} RouteManifest
 * @property {string} entry App Router entry name, for example `/(app)/dashboard/page`.
 * @property {ClientReferenceManifest} manifest
 */

/**
 * The JavaScript files one route ships, before measuring.
 * @typedef {object} RouteFiles
 * @property {string} entry
 * @property {string} route URL path, for example `/dashboard`.
 * @property {string[]} files Deduplicated `.js` paths relative to the dist dir, sorted.
 */

/**
 * @typedef {object} MeasuredFile
 * @property {string} path
 * @property {number} rawBytes
 * @property {number} gzippedBytes
 */

/**
 * The measured size of one route.
 * @typedef {object} RouteSize
 * @property {string} entry
 * @property {string} route
 * @property {number} gzippedBytes Sum of the gzipped sizes of `files`.
 * @property {MeasuredFile[]} files
 */

/** @typedef {"ok" | "over" | "exempt"} RouteStatus */

/**
 * @typedef {RouteSize & { status: RouteStatus, overBytes: number }} RouteVerdict
 */

/**
 * @typedef {object} BudgetResult
 * @property {boolean} ok True when no non-exempt route exceeds the budget.
 * @property {number} budgetBytes
 * @property {RouteVerdict[]} routes Every route, largest first.
 * @property {RouteVerdict[]} violations The routes with status `over`, largest first.
 */

/**
 * Parses the source of one `.next/server/app/<entry>_client-reference-manifest.js`.
 *
 * Accepts both bundlers' layouts: Turbopack writes
 * `globalThis.__RSC_MANIFEST["<entry>"] = {...};` on its own line, webpack
 * writes `globalThis.__RSC_MANIFEST=(globalThis.__RSC_MANIFEST||{});globalThis.__RSC_MANIFEST["<entry>"]={...}`.
 *
 * @param {string} source
 * @returns {RouteManifest}
 */
export function parseClientReferenceManifest(source) {
  const match =
    /__RSC_MANIFEST\[\s*("(?:[^"\\]|\\.)*")\s*\]\s*=\s*(\{[\s\S]*\})\s*;?\s*$/.exec(
      source,
    );
  if (!match || match[1] === undefined || match[2] === undefined) {
    throw new Error(
      'Unrecognised client reference manifest: expected `globalThis.__RSC_MANIFEST["<entry>"] = {...}`.',
    );
  }
  /** @type {unknown} */
  const entry = JSON.parse(match[1]);
  /** @type {unknown} */
  const manifest = JSON.parse(match[2]);
  if (typeof entry !== "string" || typeof manifest !== "object" || !manifest) {
    throw new Error(
      "Unrecognised client reference manifest: entry must be a string and the manifest an object.",
    );
  }
  return { entry, manifest: /** @type {ClientReferenceManifest} */ (manifest) };
}

/**
 * Derives the URL path of an entry when `.next/app-path-routes-manifest.json`
 * has no record of it: drops the `/page` or `/route` suffix and the segments
 * that never appear in URLs (route groups `(group)` and parallel slots `@slot`).
 *
 * @param {string} entry For example `/(app)/dashboard/page`.
 * @returns {string} For example `/dashboard`.
 */
export function routeFromEntry(entry) {
  const segments = entry
    .replace(/\/(page|route)$/, "")
    .split("/")
    .filter(
      (segment) =>
        segment !== "" && !/^\(.*\)$/.test(segment) && !segment.startsWith("@"),
    );
  return `/${segments.join("/")}`;
}

/**
 * Makes a chunk reference relative to the dist dir. `entryJSFiles` already are
 * (`static/chunks/x.js`); `clientModules[*].chunks` are URL paths
 * (`/_next/static/chunks/x.js`).
 *
 * @param {string} chunk
 * @returns {string}
 */
export function normalizeChunkPath(chunk) {
  return chunk.replace(/^\/?_next\//, "").replace(/^\/+/, "");
}

/**
 * @param {string} chunk
 * @returns {boolean}
 */
export function isJavaScriptChunk(chunk) {
  return /\.m?js$/.test(chunk);
}

/**
 * The client chunks the HTML of an entry references. Turbopack lists them per
 * segment in `entryJSFiles`. webpack has no such field, so fall back to the
 * chunks of every client module the route can reference; that includes
 * lazily loaded ones, so it over-counts rather than under-counts.
 *
 * @param {ClientReferenceManifest} manifest
 * @returns {string[]}
 */
function clientEntryChunks(manifest) {
  if (manifest.entryJSFiles) {
    return Object.values(manifest.entryJSFiles).flat();
  }
  return Object.values(manifest.clientModules ?? {}).flatMap(
    (module) => module.chunks ?? [],
  );
}

/**
 * Lists, for every page entry, the JavaScript files its HTML loads: the
 * bootstrap scripts from the build manifest plus the client chunks of every
 * segment in the route, deduplicated. Route handlers (`.../route`) respond
 * with data rather than HTML and are skipped.
 *
 * @param {RouteManifest[]} manifests One per `<entry>_client-reference-manifest.js`.
 * @param {BuildManifest} buildManifest Parsed `.next/build-manifest.json`.
 * @param {{ appPathRoutes?: Record<string, string>, includePolyfills?: boolean }} [options]
 *   `appPathRoutes` is the parsed `.next/app-path-routes-manifest.json`;
 *   `includePolyfills` also counts the `nomodule` polyfill scripts.
 * @returns {RouteFiles[]} Sorted by route.
 */
export function routesFromManifests(manifests, buildManifest, options = {}) {
  const { appPathRoutes = {}, includePolyfills = false } = options;
  /** @type {RouteFiles[]} */
  const routes = [];
  for (const { entry, manifest } of manifests) {
    if (entry.endsWith("/route")) continue;
    /** @type {Set<string>} */
    const chunks = new Set();
    const bootstrap =
      buildManifest.rootMainFilesTree?.[entry] ?? buildManifest.rootMainFiles;
    for (const chunk of bootstrap) chunks.add(normalizeChunkPath(chunk));
    if (includePolyfills) {
      for (const chunk of buildManifest.polyfillFiles ?? []) {
        chunks.add(normalizeChunkPath(chunk));
      }
    }
    for (const chunk of clientEntryChunks(manifest)) {
      chunks.add(normalizeChunkPath(chunk));
    }
    routes.push({
      entry,
      route: appPathRoutes[entry] ?? routeFromEntry(entry),
      files: [...chunks].filter(isJavaScriptChunk).sort(),
    });
  }
  return routes.sort((a, b) => a.route.localeCompare(b.route));
}

/**
 * Compresses each distinct file once and sums the results.
 *
 * @param {string[]} files Paths relative to the dist dir; duplicates count once.
 * @param {(file: string) => Uint8Array} readFile Returns the file's bytes.
 * @param {(data: Uint8Array) => Uint8Array} [compress] Defaults to gzip at
 *   zlib's default level (6), matching what CDNs and `next start` serve.
 * @returns {{ gzippedBytes: number, files: MeasuredFile[] }}
 */
export function sumGzipped(
  files,
  readFile,
  compress = (data) => gzipSync(data),
) {
  /** @type {MeasuredFile[]} */
  const measured = [];
  let gzippedBytes = 0;
  for (const file of new Set(files)) {
    const raw = readFile(file);
    const compressed = compress(raw).byteLength;
    measured.push({
      path: file,
      rawBytes: raw.byteLength,
      gzippedBytes: compressed,
    });
    gzippedBytes += compressed;
  }
  return { gzippedBytes, files: measured };
}

/**
 * Applies the budget: a route fails when its gzipped size is strictly greater
 * than `budgetBytes`, unless its entry matches `exemptPattern`.
 *
 * @param {RouteSize[]} routes
 * @param {number} budgetBytes
 * @param {RegExp} [exemptPattern] Tested against each entry name; defaults to
 *   the session room route.
 * @returns {BudgetResult}
 */
export function evaluateBudget(
  routes,
  budgetBytes,
  exemptPattern = DEFAULT_EXEMPT_PATTERN,
) {
  const verdicts = routes
    .map((size) => {
      exemptPattern.lastIndex = 0;
      const exempt = exemptPattern.test(size.entry);
      const overBytes = Math.max(0, size.gzippedBytes - budgetBytes);
      /** @type {RouteStatus} */
      const status = exempt ? "exempt" : overBytes > 0 ? "over" : "ok";
      return { ...size, status, overBytes };
    })
    .sort(
      (a, b) =>
        b.gzippedBytes - a.gzippedBytes || a.route.localeCompare(b.route),
    );
  const violations = verdicts.filter((verdict) => verdict.status === "over");
  return {
    ok: violations.length === 0,
    budgetBytes,
    routes: verdicts,
    violations,
  };
}

/**
 * @param {number} bytes
 * @returns {string} For example `142.0 KB`.
 */
export function formatKb(bytes) {
  return `${(bytes / KIB).toFixed(1)} KB`;
}

/**
 * Renders the per-route table: route, gzipped size, status; largest first.
 *
 * @param {BudgetResult} result
 * @returns {string}
 */
export function formatReport(result) {
  const header = ["Route", "Gzipped JS", "Status"];
  const rows = result.routes.map((verdict) => [
    verdict.route,
    formatKb(verdict.gzippedBytes),
    statusLabel(verdict),
  ]);
  const widths = header.map((title, column) =>
    Math.max(title.length, ...rows.map((row) => row[column]?.length ?? 0)),
  );
  /** @param {string[]} cells */
  const line = (cells) =>
    cells
      .map((cell, column) => {
        const width = widths[column] ?? 0;
        return column === 1 ? cell.padStart(width) : cell.padEnd(width);
      })
      .join("  ")
      .trimEnd();
  return [
    line(header),
    line(widths.map((width) => "-".repeat(width))),
    ...rows.map(line),
  ].join("\n");
}

/**
 * @param {RouteVerdict} verdict
 * @returns {string}
 */
function statusLabel(verdict) {
  switch (verdict.status) {
    case "ok":
      return "ok";
    case "over":
      return `OVER by ${formatKb(verdict.overBytes)}`;
    case "exempt":
      return "exempt (room route)";
  }
}
