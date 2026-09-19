import Link from "next/link";
import type { ReactElement } from "react";

import { Wordmark } from "@/components/shell/wordmark";

/**
 * Layout of the sign-in, sign-up, verification and reset pages: a single
 * centred column without the app shell (design "Route map"). The wordmark
 * leads back to Home; the footer links the legal pages required by the
 * Google consent screen (F1-R12).
 */
export default function AuthLayout({
  children,
}: LayoutProps<"/">): ReactElement {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4">
      <header className="flex justify-center py-8">
        <Wordmark />
      </header>
      <main id="main" className="flex flex-1 flex-col justify-center pb-8">
        {children}
      </main>
      <footer className="py-6 text-center text-xs text-ink-muted">
        <nav aria-label="Legal">
          <ul className="flex justify-center gap-4">
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
      </footer>
    </div>
  );
}
