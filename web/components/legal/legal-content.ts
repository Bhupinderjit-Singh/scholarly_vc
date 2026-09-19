/**
 * Shared constants for the static legal pages (F1-R12). The pages themselves
 * live in `app/privacy/page.tsx` and `app/terms/page.tsx`; this module keeps
 * the values both pages (and their tests) agree on in one place.
 */

/** The two legal pages, keyed by route segment. */
export const LEGAL_PAGES = {
  privacy: { href: "/privacy", title: "Privacy Policy" },
  terms: { href: "/terms", title: "Terms of Use" },
} as const;

export type LegalPageKey = keyof typeof LEGAL_PAGES;

/** Display order for footer links; typed so a new page cannot be forgotten. */
export const LEGAL_PAGE_ORDER = [
  "privacy",
  "terms",
] as const satisfies readonly LegalPageKey[];

/**
 * Shown as "Last updated" on both pages. Bump it whenever the copy changes in
 * a way readers should notice (new data, new vendor, new retention period).
 * `iso` feeds `<time dateTime>`; `label` is what people read.
 */
export const LEGAL_UPDATED = {
  iso: "2026-09-19",
  label: "19 September 2026",
} as const;

/**
 * How readers reach the owner with privacy questions or requests.
 *
 * TODO(owner): replace with a real contact channel (an email address or a
 * link) before submitting the Google OAuth consent screen, which asks for a
 * reachable contact. Never invent an address here; until one exists the
 * pages point at the sign-in page, where the owner can publish it.
 */
export const PRIVACY_CONTACT =
  "the owner, at the address shown on the sign-in page";

/**
 * Governing law named in the Terms of Use.
 *
 * TODO(owner): replace with the actual country (and, if relevant, state) of
 * residence before publishing.
 */
export const GOVERNING_LAW = "the laws of the owner's country of residence";
