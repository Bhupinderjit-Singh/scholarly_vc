// Smoke test for the `api` Vitest project. Task 1.4 adds the first real
// API test (GET /api/health against `DATABASE_URL_TEST`).
import { describe, expect, it } from "vitest";

describe("vitest api project", () => {
  it("runs in a node environment", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof process.versions.node).toBe("string");
  });
});
