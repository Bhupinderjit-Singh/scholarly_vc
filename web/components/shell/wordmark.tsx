import { GraduationCap } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";

import { cn } from "@/lib/utils";

/** "Scholarly" wordmark linking to Home; used by the app header and the auth layout. */
export function Wordmark({ className }: { className?: string }): ReactElement {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 rounded-md text-lg font-semibold tracking-tight text-ink",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-7 items-center justify-center rounded-lg bg-lavender"
      >
        <GraduationCap className="size-4 text-ink" />
      </span>
      Scholarly
    </Link>
  );
}
