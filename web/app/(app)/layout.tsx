import type { ReactElement } from "react";

import { AppShell } from "@/components/shell/app-shell";

/**
 * Layout of every authenticated route: the app shell around the page.
 *
 * Authentication does not exist yet. Task 4.5 replaces the placeholders
 * below with `requireUser()` data (a `ShellUser` and `isAdmin(email)`) and
 * mounts `UnverifiedBanner`; task 8.2 mounts `TimezoneSync`. Keep runtime
 * data access out of this layout (or inside its own `<Suspense>`) so the
 * segment `loading.tsx` skeletons still show on navigation.
 */
export default function AppLayout({
  children,
}: LayoutProps<"/">): ReactElement {
  return (
    <AppShell user={null} isAdmin={false}>
      {children}
    </AppShell>
  );
}
