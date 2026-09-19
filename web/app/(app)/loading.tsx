import type { ReactElement } from "react";

import { Skeleton } from "@/components/ui/skeleton";

const SECTION_IDS = ["live-now", "upcoming", "pending-invites"] as const;

/**
 * Skeleton for Home (F1-R2.5), shaped like `app/(app)/page.tsx`: the page
 * header, the two action cards, then the three sections. Heights are fixed
 * so the real content replaces it without layout shift.
 */
export default function HomeLoading(): ReactElement {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-8">
      <span className="sr-only">Loading Home</span>
      <div aria-hidden="true" className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-28 sm:h-9" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <div className="flex flex-col gap-8">
          {SECTION_IDS.map((id) => (
            <div key={id} className="flex flex-col gap-3">
              <Skeleton className="h-7 w-36" />
              <Skeleton className="h-56 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
