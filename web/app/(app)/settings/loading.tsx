import type { ReactElement } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const FIELD_IDS = ["name", "username", "email", "timezone"] as const;

/**
 * Skeleton for a settings section page (F1-R2.5): a form card with a title,
 * four label + control rows and a save button, matching the profile form.
 *
 * `settings/layout.tsx` (task 8.1) owns the two-column frame and the section
 * nav; Next.js renders this fallback inside that layout, in the page column,
 * so the nav is deliberately not repeated here.
 */
export default function SettingsLoading(): ReactElement {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading settings</span>
      <Card aria-hidden="true">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </CardHeader>
        <CardContent className="gap-5">
          {FIELD_IDS.map((id) => (
            <div key={id} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <Skeleton className="h-9 w-28" />
        </CardContent>
      </Card>
    </div>
  );
}
