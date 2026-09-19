import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The view's primary action as a link; pass a `ReactNode` for anything else. */
export type EmptyStateAction = {
  label: string;
  href: string;
};

/** Pastel surface behind the empty state; text is always ink on top of it. */
export type EmptyStateTone =
  "lavender" | "mint" | "sky" | "butter" | "peach" | "blush";

export type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  /** One sentence saying what will appear here and why it is empty (F1-R2.9). */
  description: string;
  /** The view's one primary action: a link, or a custom node such as a form button. */
  action?: EmptyStateAction | ReactNode;
  tone?: EmptyStateTone;
  /** Heading level of the title; `h3` under a section heading, `h2` when page-level. */
  headingLevel?: "h2" | "h3";
  className?: string;
};

const TONE_CLASSES: Record<EmptyStateTone, string> = {
  lavender: "bg-lavender",
  mint: "bg-mint",
  sky: "bg-sky",
  butter: "bg-butter",
  peach: "bg-peach",
  blush: "bg-blush",
};

function isLinkAction(
  action: EmptyStateAction | ReactNode,
): action is EmptyStateAction {
  return (
    typeof action === "object" &&
    action !== null &&
    "href" in action &&
    "label" in action
  );
}

/**
 * Empty state for a list or view without data: an explanation and that
 * view's primary action (F1-R2.9), on a pastel surface with ink text.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "lavender",
  headingLevel: Heading = "h3",
  className,
}: EmptyStateProps): ReactElement {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-xl px-6 py-10 text-center shadow-soft",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {Icon === undefined ? null : (
        <span className="flex size-12 items-center justify-center rounded-full bg-white/70">
          <Icon aria-hidden="true" className="size-6 text-ink" />
        </span>
      )}
      <div className="flex flex-col gap-1">
        <Heading className="text-base font-semibold text-ink">{title}</Heading>
        <p className="max-w-prose text-sm text-ink-muted">{description}</p>
      </div>
      {renderAction(action)}
    </div>
  );
}

function renderAction(action: EmptyStateAction | ReactNode): ReactNode {
  if (isLinkAction(action)) {
    return (
      <Button asChild>
        <Link href={action.href}>{action.label}</Link>
      </Button>
    );
  }
  return action ?? null;
}
