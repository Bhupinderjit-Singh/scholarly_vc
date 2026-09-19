// Smoke test for the `node` Vitest project: confirms the environment and
// that fast-check is wired up. Real domain tests live next to their
// modules under `lib/**` and replace this as the codebase grows.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

describe("vitest node project", () => {
  it("runs without a DOM", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });

  it("runs property-based tests with fast-check", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a);
      }),
    );
  });
});
