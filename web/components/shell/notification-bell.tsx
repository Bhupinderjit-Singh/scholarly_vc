"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";

/**
 * Notification bell placeholder. It links to `/notifications` so it is
 * keyboard reachable today; spec 05 adds the unread badge, the popover and
 * writes announcements into the `aria-live` region below, which is created
 * here so that contract is fixed (tech.md "Accessibility").
 */
export function NotificationBell(): ReactElement {
  return (
    <>
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="rounded-full"
        aria-label="Notifications"
      >
        <Link href="/notifications">
          <Bell aria-hidden="true" />
        </Link>
      </Button>
      <span
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-slot="notification-announcer"
      />
    </>
  );
}
