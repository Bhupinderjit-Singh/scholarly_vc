"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";

import { cn } from "@/lib/utils";

import { isNavItemActive, NAV_ITEMS } from "./nav-items";

/**
 * Desktop primary navigation (F1-R2.3). Hidden below the `lg` breakpoint
 * (1024 px), where `BottomNav` takes over. Client component only because
 * the active item comes from `usePathname()`.
 */
export function TopNav(): ReactElement {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-md px-3 text-sm transition-colors",
                  active
                    ? "bg-lavender font-medium text-ink"
                    : "text-ink-muted hover:bg-muted hover:text-ink",
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
