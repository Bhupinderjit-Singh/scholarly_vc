import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  colors,
  composite,
  compositedPairs,
  contrastRatio,
  MIN_TEXT_CONTRAST,
  parseHex,
  relativeLuminance,
  resolveCompositedPair,
  textOnSurfacePairs,
  toHex,
} from "@/lib/design/tokens";

// Arbitrary `#rrggbb` color.
const hexColor = fc
  .tuple(fc.nat(255), fc.nat(255), fc.nat(255))
  .map(([r, g, b]) => toHex([r, g, b]));

describe("F1-R2.2 Property 9 contrast", () => {
  it("lists at least one pair for every text color the theme uses", () => {
    const texts = new Set(textOnSurfacePairs.map((pair) => pair.text));
    expect(texts).toEqual(
      new Set(["ink", "inkMuted", "paper", "destructive", "white"]),
    );
  });

  it("uses every pastel surface from tech.md with ink and ink-muted text", () => {
    const pastels = ["lavender", "mint", "peach", "sky", "butter", "blush"];
    for (const surface of pastels) {
      for (const text of ["ink", "inkMuted"]) {
        expect(
          textOnSurfacePairs.some(
            (pair) => pair.text === text && pair.surface === surface,
          ),
          `${text} on ${surface} should be a declared pair`,
        ).toBe(true);
      }
    }
  });

  describe.each(textOnSurfacePairs)(
    "$text on $surface ($where)",
    ({ text, surface }) => {
      it(`has a contrast ratio of at least ${MIN_TEXT_CONTRAST}:1`, () => {
        const ratio = contrastRatio(colors[text], colors[surface]);
        expect(ratio).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      });
    },
  );

  describe.each(compositedPairs)("composited: $where", (pair) => {
    it(`has a contrast ratio of at least ${MIN_TEXT_CONTRAST}:1`, () => {
      const { text, surface } = resolveCompositedPair(pair);
      expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(
        MIN_TEXT_CONTRAST,
      );
    });
  });

  it("never paints a pastel token as text", () => {
    const pastels = new Set([
      "lavender",
      "mint",
      "peach",
      "sky",
      "butter",
      "blush",
    ]);
    for (const pair of textOnSurfacePairs) {
      expect(pastels.has(pair.text), `${pair.text} used as text`).toBe(false);
    }
  });
});

describe("WCAG 2.1 contrast math", () => {
  it("gives black on white a ratio of 21:1", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("gives identical colors a ratio of 1:1", () => {
    expect(contrastRatio("#1F2933", "#1F2933")).toBe(1);
  });

  it("matches published reference values", () => {
    // WCAG example: pure white is luminance 1, pure black is 0.
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 10);
    expect(relativeLuminance("#000000")).toBe(0);
    // Mid gray #777777 on white is the classic 4.48:1 (just below AA).
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
    // #767676 on white is the smallest gray that passes AA (4.54:1).
    expect(contrastRatio("#767676", "#FFFFFF")).toBeCloseTo(4.54, 2);
  });

  it("parses short and long hex forms and round-trips through toHex", () => {
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
    expect(parseHex("#1F2933")).toEqual([31, 41, 51]);
    expect(toHex(parseHex("#1f2933"))).toBe("#1F2933");
  });

  it("rejects malformed colors", () => {
    expect(() => parseHex("1F2933")).toThrow(/Expected a #rgb or #rrggbb/);
    expect(() => parseHex("#12345")).toThrow(/Expected a #rgb or #rrggbb/);
    expect(() => parseHex("rgb(0,0,0)")).toThrow(/Expected a #rgb or #rrggbb/);
  });

  it("composites source-over in sRGB", () => {
    expect(composite("#000000", "#FFFFFF", 0)).toBe("#FFFFFF");
    expect(composite("#000000", "#FFFFFF", 1)).toBe("#000000");
    expect(composite("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(() => composite("#000000", "#FFFFFF", 1.5)).toThrow(/alpha/);
  });

  it("is symmetric and at least 1 for any two colors", () => {
    fc.assert(
      fc.property(hexColor, hexColor, (a, b) => {
        const ab = contrastRatio(a, b);
        const ba = contrastRatio(b, a);
        expect(ab).toBeCloseTo(ba, 12);
        expect(ab).toBeGreaterThanOrEqual(1);
        expect(ab).toBeLessThanOrEqual(21);
      }),
    );
  });

  it("keeps relative luminance within [0, 1] and monotonic in gray level", () => {
    fc.assert(
      fc.property(hexColor, (hex) => {
        const l = relativeLuminance(hex);
        expect(l).toBeGreaterThanOrEqual(0);
        expect(l).toBeLessThanOrEqual(1);
      }),
    );
    fc.assert(
      fc.property(fc.nat(255), fc.nat(255), (x, y) => {
        const lx = relativeLuminance(toHex([x, x, x]));
        const ly = relativeLuminance(toHex([y, y, y]));
        expect(Math.sign(lx - ly)).toBe(Math.sign(x - y));
      }),
    );
  });

  it("never raises contrast by fading text toward its surface", () => {
    // Guards the `text-destructive/90` style pairs: compositing text onto
    // the surface it sits on can only lower the ratio, so checking the
    // opaque pair is the optimistic bound and the faded one must be checked.
    fc.assert(
      fc.property(
        hexColor,
        fc.double({ min: 0, max: 1, noNaN: true }),
        (text, alpha) => {
          const surface = "#FFFFFF";
          const faded = composite(text, surface, alpha);
          expect(contrastRatio(faded, surface)).toBeLessThanOrEqual(
            contrastRatio(text, surface) + 1e-9,
          );
        },
      ),
    );
  });
});
