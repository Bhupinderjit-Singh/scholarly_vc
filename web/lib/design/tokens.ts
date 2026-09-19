/**
 * Scholarly design tokens (tech.md "Design tokens") as data, so tests can
 * check every text/surface pair for WCAG 2.1 contrast (F1-R2.2, Property 9).
 * The CSS source of truth is `app/globals.css`; keep both in sync.
 *
 * shadcn/ui setup that produced `components/ui` (spec 01, task 2.1):
 *   CLI: shadcn 4.21.0 (Tailwind v4, preset-based; no `--base-color` or
 *   `--src-dir` flags any more, and `--template` must be omitted because it
 *   scaffolds a new project instead of initializing the existing one).
 *   npx shadcn@4.21.0 init --base radix --preset vega --yes --css-variables \
 *     --no-monorepo --no-rtl
 *   npx shadcn@4.21.0 add button input label card dialog dropdown-menu avatar \
 *     badge skeleton sonner tabs switch command tooltip sheet separator alert \
 *     --yes --overwrite
 *   The `vega` preset means: style radix-vega, base color neutral, Lucide
 *   icons, Inter font. `command` pulled in `input-group` and `textarea`.
 */

/** Hex colors the theme paints text or surfaces with. */
export const colors = {
  lavender: "#E6E0F8",
  mint: "#D9F2E6",
  peach: "#FFE5D4",
  sky: "#DCEEFB",
  butter: "#FFF3C4",
  blush: "#FADDE1",
  ink: "#1F2933",
  inkMuted: "#52606D",
  paper: "#FBFAF7",
  line: "#E4E7EB",
  white: "#FFFFFF",
  /** `--muted`: subdued surface behind helper text and hover states. */
  muted: "#F1EFF9",
  /** `--destructive`: deep rose used as text on light surfaces. */
  destructive: "#9F1D35",
} as const;

export type ColorName = keyof typeof colors;

/** One (text, surface) combination the CSS actually produces. */
export interface TextOnSurfacePair {
  readonly text: ColorName;
  readonly surface: ColorName;
  /** Where in the UI this pair appears; makes a failing test self-explaining. */
  readonly where: string;
}

/**
 * Every text/surface pair the theme uses. Rule from the design: text is
 * always ink or ink-muted, pastels are surfaces; the exceptions are the
 * primary button (paper on ink) and destructive text (deep rose on light).
 * Adding a pair here is how a new combination gets its contrast checked.
 */
export const textOnSurfacePairs: ReadonlyArray<TextOnSurfacePair> = [
  // Ink (--foreground) on every surface.
  { text: "ink", surface: "paper", where: "body text on the page background" },
  { text: "ink", surface: "white", where: "card, popover and dialog text" },
  { text: "ink", surface: "muted", where: "ghost/outline hover, muted panels" },
  {
    text: "ink",
    surface: "lavender",
    where: "session cards, secondary button",
  },
  { text: "ink", surface: "mint", where: "success and live-now surfaces" },
  { text: "ink", surface: "peach", where: "warning and streak surfaces" },
  { text: "ink", surface: "sky", where: "info, calendar, accent surfaces" },
  { text: "ink", surface: "butter", where: "highlight and target surfaces" },
  { text: "ink", surface: "blush", where: "soft danger surfaces" },

  // Ink-muted (--muted-foreground): secondary text and placeholders.
  { text: "inkMuted", surface: "paper", where: "secondary text on the page" },
  {
    text: "inkMuted",
    surface: "white",
    where: "card descriptions, placeholders",
  },
  { text: "inkMuted", surface: "muted", where: "helper text on muted panels" },
  {
    text: "inkMuted",
    surface: "lavender",
    where: "secondary text on session cards",
  },
  {
    text: "inkMuted",
    surface: "mint",
    where: "secondary text on live-now cards",
  },
  {
    text: "inkMuted",
    surface: "peach",
    where: "secondary text on streak cards",
  },
  {
    text: "inkMuted",
    surface: "sky",
    where: "secondary text on calendar cards",
  },
  {
    text: "inkMuted",
    surface: "butter",
    where: "secondary text on target cards",
  },
  {
    text: "inkMuted",
    surface: "blush",
    where: "secondary text on danger cards",
  },

  // Inverted: primary button and badge.
  { text: "paper", surface: "ink", where: "primary button and badge label" },

  // Destructive text on light surfaces (shadcn v4 tints; it never fills).
  {
    text: "destructive",
    surface: "white",
    where: "destructive alert on a card",
  },
  {
    text: "destructive",
    surface: "paper",
    where: "destructive link on the page",
  },
  {
    text: "destructive",
    surface: "blush",
    where: "destructive confirm surface",
  },

  // Filled destructive control (bg-destructive text-white), if a feature adds one.
  { text: "white", surface: "destructive", where: "filled destructive button" },
];

/**
 * Translucent text/surface treatments shadcn v4 uses for destructive
 * controls. `alpha` composites `over` onto `under` before the ratio is
 * taken, so the test checks the color the user actually sees.
 */
export interface CompositedPair {
  readonly text: ColorName;
  /** Color composited over the surface (`text` itself for tinted text). */
  readonly over: ColorName;
  readonly under: ColorName;
  /** Opacity of `over`, 0–1. */
  readonly alpha: number;
  /** When true, `text` is composited (text/90); otherwise the surface is. */
  readonly tintsText: boolean;
  readonly where: string;
}

export const compositedPairs: ReadonlyArray<CompositedPair> = [
  {
    text: "destructive",
    over: "destructive",
    under: "paper",
    alpha: 0.1,
    tintsText: false,
    where: "destructive button/badge (bg-destructive/10) on the page",
  },
  {
    text: "destructive",
    over: "destructive",
    under: "white",
    alpha: 0.1,
    tintsText: false,
    where: "destructive button/badge (bg-destructive/10) on a card",
  },
  {
    text: "destructive",
    over: "destructive",
    under: "white",
    alpha: 0.2,
    tintsText: false,
    where: "destructive button hover (bg-destructive/20) on a card",
  },
  {
    text: "destructive",
    over: "destructive",
    under: "white",
    alpha: 0.9,
    tintsText: true,
    where: "destructive alert description (text-destructive/90) on a card",
  },
];

/** WCAG 2.1 minimum contrast for normal text (Success Criterion 1.4.3). */
export const MIN_TEXT_CONTRAST = 4.5;

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Parses `#rgb` or `#rrggbb` into 0–255 channels. Throws on anything else. */
export function parseHex(hex: string): readonly [number, number, number] {
  if (!HEX_COLOR.test(hex)) {
    throw new Error(`Expected a #rgb or #rrggbb color, got "${hex}"`);
  }
  const digits = hex.slice(1);
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((d) => d + d)
          .join("")
      : digits;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

/** Formats 0–255 channels (rounded and clamped) as `#rrggbb`. */
export function toHex(rgb: readonly [number, number, number]): string {
  return `#${rgb
    .map((c) => Math.round(Math.min(255, Math.max(0, c))))
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Relative luminance per WCAG 2.1 (sRGB linearization, Rec. 709 weights).
 * Returns a value in [0, 1].
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * WCAG 2.1 contrast ratio `(L1 + 0.05) / (L2 + 0.05)` with L1 the lighter
 * color. Symmetric in its arguments; ranges from 1 to 21.
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Source-over compositing of `over` at `alpha` onto an opaque `under`, in
 * sRGB space (what browsers do for `bg-destructive/10`). Returns `#rrggbb`.
 */
export function composite(over: string, under: string, alpha: number): string {
  if (!(alpha >= 0 && alpha <= 1)) {
    throw new Error(`alpha must be within 0–1, got ${alpha}`);
  }
  const o = parseHex(over);
  const u = parseHex(under);
  return toHex([
    o[0] * alpha + u[0] * (1 - alpha),
    o[1] * alpha + u[1] * (1 - alpha),
    o[2] * alpha + u[2] * (1 - alpha),
  ]);
}

/** Resolves a composited pair to the opaque text and surface colors seen. */
export function resolveCompositedPair(pair: CompositedPair): {
  text: string;
  surface: string;
} {
  const blended = composite(colors[pair.over], colors[pair.under], pair.alpha);
  return pair.tintsText
    ? { text: blended, surface: colors[pair.under] }
    : { text: colors[pair.text], surface: blended };
}
