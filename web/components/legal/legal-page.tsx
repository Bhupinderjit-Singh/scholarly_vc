import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

import {
  LEGAL_PAGE_ORDER,
  LEGAL_PAGES,
  type LegalPageKey,
} from "@/components/legal/legal-content";

interface LegalPageProps {
  /** Which legal page this is; drives the cross-links and `aria-current`. */
  page: LegalPageKey;
  title: string;
  /** Last-updated date: `iso` for `<time dateTime>`, `label` for people. */
  updated: { readonly iso: string; readonly label: string };
  /** Plain-words summary shown in the pastel card under the heading. */
  intro: ReactNode;
  /** The `LegalSection`s. */
  children: ReactNode;
}

/*
 * Prose styling without `@tailwindcss/typography` (not installed): the
 * descendant variants below style the `p`, `ul`, `ol`, `dl` and `a` elements
 * that the page bodies write as plain HTML. Ink on paper throughout; the only
 * pastel surface is the lavender summary card (text/surface pairs already
 * covered by tests/unit/theme-contrast.test.ts).
 */
const PROSE_CLASSES =
  "text-base leading-7 text-ink [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_dd]:mt-1 [&_dl]:space-y-4 [&_dt]:font-semibold [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6";

/**
 * Shared frame for `/privacy` and `/terms` (F1-R12.1): a minimal header
 * (wordmark, the other legal page, sign-in), the article, and a small footer.
 * No app shell, no authentication, no client JavaScript, so Google's OAuth
 * consent-screen crawler and a visitor without an account both get plain,
 * readable HTML.
 */
export function LegalPage({
  page,
  title,
  updated,
  intro,
  children,
}: LegalPageProps): ReactElement {
  const otherKey: LegalPageKey = page === "privacy" ? "terms" : "privacy";
  const other = LEGAL_PAGES[otherKey];

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="border-b border-line">
        <nav
          aria-label="Primary"
          className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-4"
        >
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Scholarly
          </Link>
          <ul className="flex items-center gap-5 text-sm text-ink-muted">
            <li>
              <Link
                href={other.href}
                className="transition-colors hover:text-ink"
              >
                {other.title}
              </Link>
            </li>
            <li>
              <Link
                href="/sign-in"
                className="transition-colors hover:text-ink"
              >
                Sign in
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:py-14">
        <article className={PROSE_CLASSES}>
          <header>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {title}
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              Last updated <time dateTime={updated.iso}>{updated.label}</time>
            </p>
          </header>

          <aside
            aria-label="Summary"
            className="mt-8 space-y-3 rounded-xl bg-lavender p-6 shadow-soft"
          >
            {intro}
          </aside>

          <div className="mt-12 space-y-10">{children}</div>
        </article>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-ink-muted">
          <p>
            Scholarly is a personal project run for a small circle of friends.
          </p>
          <nav aria-label="Legal">
            <ul className="flex items-center gap-5">
              {LEGAL_PAGE_ORDER.map((key) => {
                const entry = LEGAL_PAGES[key];
                const isCurrent = key === page;
                return (
                  <li key={key}>
                    <Link
                      href={entry.href}
                      aria-current={isCurrent ? "page" : undefined}
                      className={
                        isCurrent
                          ? "text-ink"
                          : "transition-colors hover:text-ink"
                      }
                    >
                      {entry.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
