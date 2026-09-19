import type { ReactElement, ReactNode } from "react";

import { AppFooter } from "./app-footer";
import { BottomNav } from "./bottom-nav";
import { NotificationBell } from "./notification-bell";
import { ProfileMenu } from "./profile-menu";
import { TopNav } from "./top-nav";
import type { ShellUser } from "./types";
import { Wordmark } from "./wordmark";

export type AppShellProps = {
  /** Signed-in user, or `null` before authentication is wired (task 4.5). */
  user: ShellUser | null;
  isAdmin: boolean;
  children: ReactNode;
};

/**
 * Chrome around every `(app)` page: skip link, header (wordmark, desktop
 * nav, bell, profile menu), `<main id="main">`, footer, and the mobile
 * bottom nav. The wrapper's `pb-20 lg:pb-0` keeps the fixed bottom nav from
 * covering content or the footer on small screens (F1-R2.3, F1-R2.4).
 * Server component; only the nav, bell and profile menu ship client code.
 */
export function AppShell({
  user,
  isAdmin,
  children,
}: AppShellProps): ReactElement {
  return (
    <div className="flex min-h-dvh flex-col pb-20 lg:pb-0">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-paper"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-paper">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4">
          <Wordmark />
          <TopNav />
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <ProfileMenu user={user} isAdmin={isAdmin} />
          </div>
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 outline-none sm:py-8"
      >
        {children}
      </main>
      <AppFooter />
      <BottomNav />
    </div>
  );
}
