import { CalendarDays, Mail, Radio } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { EmptyState } from "@/components/shell/empty-state";

/**
 * Titled block of Home. Each section below is its own component so spec 02
 * can swap them for data-backed versions one at a time (make a section
 * `async`, fetch, and render its list; keep `HomeSection` and the
 * `EmptyState` for the no-data case).
 */
export function HomeSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}): ReactElement {
  const headingId = `${id}-heading`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Sessions that are `live` right now and that the user may join. */
export function LiveNowSection(): ReactElement {
  return (
    <HomeSection id="live-now" title="Live now">
      <EmptyState
        tone="mint"
        icon={Radio}
        title="Nobody is studying right now"
        description="Sessions that are live appear here so you can join with one click."
        action={{ label: "Start a session", href: "/sessions/new?instant=1" }}
      />
    </HomeSection>
  );
}

/** Scheduled sessions the user hosts or has accepted, soonest first. */
export function UpcomingSection(): ReactElement {
  return (
    <HomeSection id="upcoming" title="Upcoming">
      <EmptyState
        tone="sky"
        icon={CalendarDays}
        title="Nothing scheduled yet"
        description="Sessions you host or accepted show up here before they start."
        action={{ label: "Schedule a session", href: "/sessions/new" }}
      />
    </HomeSection>
  );
}

/** Invitations waiting for the user to accept or decline. */
export function PendingInvitesSection(): ReactElement {
  return (
    <HomeSection id="pending-invites" title="Pending invites">
      <EmptyState
        tone="lavender"
        icon={Mail}
        title="No pending invites"
        description="Invitations from friends wait here until you accept or decline them."
        action={{ label: "Invite friends to a session", href: "/sessions/new" }}
      />
    </HomeSection>
  );
}

/** The data sections of Home in display order. */
export function HomeSections(): ReactElement {
  return (
    <div className="flex flex-col gap-8">
      <LiveNowSection />
      <UpcomingSection />
      <PendingInvitesSection />
    </div>
  );
}
