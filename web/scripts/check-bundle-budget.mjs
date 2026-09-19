#!/usr/bin/env node
// @ts-check
/**
 * Enforces the JavaScript bundle budget after `next build` (spec
 * 01-foundation-auth, task 2.4; F1-R2.10; tech.md "Performance budgets").
 *
 * Reads the build output, sums the gzipped size of the JavaScript every route
 * ships, prints one line per route, and exits 1 when any route other than the
 * session room (`/sessions/[id]/room`) exceeds 200 KB. Exit code 2 means the
 * script could not run (no build output, bad flag).
 *
 * Usage: node scripts/check-bundle-budget.mjs [--budget-kb <n>] [--dist-dir <path>] [--include-polyfills]
 *
 * Confirmed build output for Next.js 16.3.5 (Turbopack): there is no
 * `.next/app-build-manifest.json` any more. The bootstrap scripts come from
 * `.next/build-manifest.json` (`rootMainFiles`), the per-route client chunks
 * from `.next/server/app/<entry>_client-reference-manifest.js`
 * (`globalThis.__RSC_MANIFEST["<entry>"].entryJSFiles`), and route names from
 * `.next/app-path-routes-manifest.json`. See `scripts/bundle-budget/lib.mjs`
 * for the recorded shapes and the measurement rules (gzip default level,
 * polyfills excluded because they are `nomodule`, 1 KB = 1024 bytes).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  DEFAULT_BUDGET_KB,
  DEFAULT_EXEMPT_PATTERN,
  evaluateBudget,
  formatKb,
  formatReport,
  KIB,
  parseClientReferenceManifest,
  routesFromManifests,
  sumGzipped,
} from "./bundle-budget/lib.mjs";

const USAGE = `Usage: node scripts/check-bundle-budget.mjs [options]

Checks the gzipped JavaScript of every App Router route after \`next build\`.

Options:
  --budget-kb <n>       Budget per route in KB (1 KB = 1024 bytes). Default: ${DEFAULT_BUDGET_KB}.
  --dist-dir <path>     Next.js output directory. Default: .next
  --include-polyfills   Also count the <script nomodule> polyfills.
  -h, --help            Show this message.

Exit codes: 0 within budget, 1 a route is over budget, 2 could not run.`;

const CLIENT_REFERENCE_MANIFEST_SUFFIX = "_client-reference-manifest.js";

/**
 * @param {string[]} argv
 * @returns {number} Process exit code.
 */
function main(argv) {
  /** @type {ReturnType<typeof parseCliArgs>} */
  let args;
  try {
    args = parseCliArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error();
    console.error(USAGE);
    return 2;
  }
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  const distDir = path.resolve(args.distDir);
  const buildManifestPath = path.join(distDir, "build-manifest.json");
  if (!existsSync(buildManifestPath)) {
    console.error(
      `Missing ${relative(buildManifestPath)}: run \`next build\` first.`,
    );
    return 2;
  }
  const appDir = path.join(distDir, "server", "app");
  const manifestFiles = findClientReferenceManifests(appDir);
  if (manifestFiles.length === 0) {
    console.error(
      `No *${CLIENT_REFERENCE_MANIFEST_SUFFIX} files under ${relative(appDir)}: ` +
        "run `next build` first, or check that the app has App Router pages.",
    );
    return 2;
  }

  const buildManifest =
    /** @type {import("./bundle-budget/lib.mjs").BuildManifest} */ (
      readJson(buildManifestPath)
    );
  const appPathRoutesPath = path.join(distDir, "app-path-routes-manifest.json");
  const appPathRoutes = /** @type {Record<string, string>} */ (
    existsSync(appPathRoutesPath) ? readJson(appPathRoutesPath) : {}
  );
  const manifests = manifestFiles.map((file) =>
    parseClientReferenceManifest(readFileSync(file, "utf8")),
  );

  const routes = routesFromManifests(manifests, buildManifest, {
    appPathRoutes,
    includePolyfills: args.includePolyfills,
  });
  const sizes = routes.map((route) => ({
    entry: route.entry,
    route: route.route,
    ...sumGzipped(route.files, (file) =>
      readFileSync(path.join(distDir, file)),
    ),
  }));
  const budgetBytes = args.budgetKb * KIB;
  const result = evaluateBudget(sizes, budgetBytes, DEFAULT_EXEMPT_PATTERN);

  console.log(
    `JavaScript budget: ${formatKb(budgetBytes)} gzipped per route` +
      ` (session room exempt${args.includePolyfills ? ", polyfills included" : ""}).`,
  );
  console.log();
  console.log(formatReport(result));
  console.log();

  if (result.ok) {
    console.log(
      `All ${result.routes.length} route(s) are within the ${formatKb(budgetBytes)} budget.`,
    );
    return 0;
  }

  for (const violation of result.violations) {
    console.log(
      `${violation.route} ships ${formatKb(violation.gzippedBytes)} of gzipped JavaScript,` +
        ` ${formatKb(violation.overBytes)} over the ${formatKb(budgetBytes)} budget. Chunks, largest first:`,
    );
    const files = [...violation.files].sort(
      (a, b) => b.gzippedBytes - a.gzippedBytes,
    );
    for (const file of files) {
      console.log(
        `  ${formatKb(file.gzippedBytes).padStart(10)} gzipped  ${formatKb(file.rawBytes).padStart(10)} raw  ${file.path}`,
      );
    }
    console.log();
    if (process.env.GITHUB_ACTIONS === "true") {
      console.log(
        `::error title=JavaScript budget exceeded::${violation.route} ships ${formatKb(violation.gzippedBytes)} gzipped, ${formatKb(violation.overBytes)} over the ${formatKb(budgetBytes)} budget (F1-R2.10).`,
      );
    }
  }
  console.error(
    `${result.violations.length} route(s) exceed the ${formatKb(budgetBytes)} JavaScript budget (F1-R2.10).` +
      " Move code behind dynamic imports, drop the dependency, or keep it server-side.",
  );
  return 1;
}

/**
 * @param {string[]} argv
 * @returns {{ help: boolean, budgetKb: number, distDir: string, includePolyfills: boolean }}
 */
function parseCliArgs(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      "budget-kb": { type: "string" },
      "dist-dir": { type: "string" },
      "include-polyfills": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });
  const budgetKb =
    values["budget-kb"] === undefined
      ? DEFAULT_BUDGET_KB
      : Number(values["budget-kb"]);
  if (!Number.isFinite(budgetKb) || budgetKb <= 0) {
    throw new Error(
      `--budget-kb must be a positive number, got "${values["budget-kb"]}".`,
    );
  }
  return {
    help: values.help ?? false,
    budgetKb,
    distDir: values["dist-dir"] ?? ".next",
    includePolyfills: values["include-polyfills"] ?? false,
  };
}

/**
 * Every `<entry>_client-reference-manifest.js` below `.next/server/app`.
 *
 * @param {string} appDir
 * @returns {string[]} Absolute paths, sorted.
 */
function findClientReferenceManifests(appDir) {
  if (!existsSync(appDir)) return [];
  return readdirSync(appDir, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(CLIENT_REFERENCE_MANIFEST_SUFFIX))
    .map((file) => path.join(appDir, file))
    .sort();
}

/**
 * @param {string} file
 * @returns {unknown}
 */
function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

/**
 * @param {string} file
 * @returns {string}
 */
function relative(file) {
  const rel = path.relative(process.cwd(), file);
  return rel === "" ? "." : rel.startsWith("..") ? file : rel;
}

process.exitCode = main(process.argv.slice(2));
