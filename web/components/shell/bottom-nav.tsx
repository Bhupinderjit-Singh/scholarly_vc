"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";

import { cn } from "@/lib/utils";

import { BOTTOM_NAV_ITEMS, isNavItemActive } from "./nav-items";

/**
 * Mobile primary navigation (F1-R2.4): fixed to the bottom edge below the
 * `lg` breakpoint, padded for the home-indicator safe area. The bell stays
 * in the header; Profile replaces the desktop profile menu.
 */
export function BottomNav(): ReactElement {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-xs transition-colors",
                  active
                    ? "font-medium text-ink"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full",
                    active && "bg-lavender",
                  )}
                >
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
