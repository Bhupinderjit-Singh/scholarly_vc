"use client";

import Link from "next/link";
import type { ReactElement } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { getInitials } from "./initials";
import { profileMenuItems } from "./profile-menu-items";
import { SignOutButton } from "./sign-out-button";
import type { ShellUser } from "./types";

export type ProfileMenuProps = {
  /** `null` while signed out: renders a "Sign in" link instead of the menu. */
  user: ShellUser | null;
  /** Adds the "Admin" entry (F1-R10); the page itself still calls `requireAdmin()`. */
  isAdmin: boolean;
};

/**
 * Avatar-triggered account menu in the header: Settings, Admin (admins
 * only), then Sign out. Client component because of the Radix dropdown.
 */
export function ProfileMenu({ user, isAdmin }: ProfileMenuProps): ReactElement {
  if (user === null) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/sign-in">Sign in</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Account menu"
        >
          <Avatar>
            {user.image === null ? null : (
              <AvatarImage src={user.image} alt="" />
            )}
            <AvatarFallback className="bg-lavender text-xs font-medium text-ink">
              {getInitials(user.displayName)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="truncate text-sm font-medium text-ink">
            {user.displayName}
          </span>
          <span className="truncate text-xs text-ink-muted">
            @{user.username}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profileMenuItems({ isAdmin }).map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.href} asChild>
              <Link href={item.href}>
                <Icon aria-hidden="true" />
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <SignOutButton />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
