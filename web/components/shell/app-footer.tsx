import Link from "next/link";
import type { ReactElement } from "react";

/** Site footer of the app shell: wordmark, tagline, and the legal pages (F1-R12). */
export function AppFooter(): ReactElement {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-semibold text-ink">Scholarly</span>
          <span aria-hidden="true"> · </span>
          Study together.
        </p>
        <nav aria-label="Legal">
          <ul className="flex gap-4">
            <li>
              <Link href="/privacy" className="hover:text-ink">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-ink">
                Terms
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
