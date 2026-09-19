import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  /** Page title, rendered as the page's single `h1`. */
  title: string;
  description?: string;
  /** Primary actions (buttons or links) aligned to the end of the header. */
  actions?: ReactNode;
  className?: string;
};

/** Title block at the top of every `(app)` page. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps): ReactElement {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {title}
        </h1>
        {description === undefined ? null : (
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        )}
      </div>
      {actions === undefined ? null : (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
