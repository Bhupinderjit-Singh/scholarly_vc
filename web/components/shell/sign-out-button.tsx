"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

/**
 * "Sign out" entry of the profile menu. Renders its own `DropdownMenuItem`,
 * so it must sit inside `DropdownMenuContent` and `profile-menu.tsx` never
 * needs to change when the behaviour does.
 *
 * TODO(task 4.4): call `authClient.signOut()` (with `onSuccess` navigating
 * to `/sign-in`) instead of linking there. Authentication does not exist
 * yet, so today this is a plain link.
 */
export function SignOutButton(): ReactElement {
  return (
    <DropdownMenuItem asChild>
      <Link href="/sign-in">
        <LogOut aria-hidden="true" />
        Sign out
      </Link>
    </DropdownMenuItem>
  );
}
