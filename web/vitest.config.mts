import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

/**
 * Three Vitest projects, selected by name from the npm scripts:
 *
 * - `node`  — pure logic under `lib/**` (domain rules, env, helpers).
 * - `jsdom` — React components with Testing Library.
 * - `api`   — route handlers against a real Postgres (`DATABASE_URL_TEST`).
 *
 * `npm run test:unit` runs `node` + `jsdom`; `npm run test:api` runs `api`.
 * Playwright owns `tests/e2e` and is deliberately not matched here.
 */
export default defineConfig({
  resolve: {
    alias: { "@": rootDir },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["lib/**/*.test.ts", "tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: [
            "components/**/*.test.{ts,tsx}",
            "app/**/*.test.tsx",
            "tests/unit/**/*.test.tsx",
          ],
          setupFiles: ["./tests/setup/jsdom.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "api",
          environment: "node",
          include: ["tests/api/**/*.test.ts"],
          // API tests share one test database; run files one at a time.
          fileParallelism: false,
        },
      },
    ],
  },
});
