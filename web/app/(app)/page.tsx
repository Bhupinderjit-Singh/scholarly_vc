import type { ReactElement } from "react";

import { HomeSections } from "@/components/home/home-sections";
import { QuickActions } from "@/components/home/quick-actions";
import { PageHeader } from "@/components/shell/page-header";

/**
 * Home: the two primary actions (Start now, Schedule) and the Live now,
 * Upcoming and Pending invites sections. Every section renders its empty
 * state until spec 02 supplies data. `app/(app)/loading.tsx` mirrors this
 * layout.
 */
export default function HomePage(): ReactElement {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Home"
        description="Study together, right now or on a schedule."
      />
      <QuickActions />
      <HomeSections />
    </div>
  );
}
