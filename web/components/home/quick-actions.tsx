import type { LucideIcon } from "lucide-react";
import { CalendarPlus, Video } from "lucide-react";
import Link from "next/link";
import { useId, type ReactElement } from "react";

import { cn } from "@/lib/utils";

type ActionCardProps = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  /** Pastel surface class; text stays ink on top of it. */
  surfaceClassName: string;
};

/**
 * A whole-card link. The title is the link's accessible name and the
 * description its accessible description, so screen readers announce
 * "Start now, link" rather than the two run together.
 */
function ActionCard({
  href,
  icon: Icon,
  title,
  description,
  surfaceClassName,
}: ActionCardProps): ReactElement {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <Link
      href={href}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={cn(
        "flex items-start gap-4 rounded-xl p-5 shadow-soft transition-shadow hover:shadow-md",
        surfaceClassName,
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/70">
        <Icon aria-hidden="true" className="size-5 text-ink" />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span id={titleId} className="text-base font-semibold text-ink">
          {title}
        </span>
        <span id={descriptionId} className="text-sm text-ink-muted">
          {description}
        </span>
      </span>
    </Link>
  );
}

/**
 * The two primary actions of Home (product.md principle 1): start an
 * instant session or schedule one. Both are links into the session form
 * that spec 02 builds; `?instant=1` preselects "Start now".
 */
export function QuickActions(): ReactElement {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ActionCard
        href="/sessions/new?instant=1"
        icon={Video}
        title="Start now"
        description="Open a live room and invite friends to join you."
        surfaceClassName="bg-mint"
      />
      <ActionCard
        href="/sessions/new"
        icon={CalendarPlus}
        title="Schedule"
        description="Pick a time and send invites ahead of the session."
        surfaceClassName="bg-sky"
      />
    </div>
  );
}
