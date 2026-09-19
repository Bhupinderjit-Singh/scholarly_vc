import type { LucideIcon } from "lucide-react";
import { Settings, ShieldCheck } from "lucide-react";

/** One link entry of the profile menu ("Sign out" is not a link; see `SignOutButton`). */
export type ProfileMenuItem = {
  readonly label: string;
  readonly href: string;
  readonly icon: LucideIcon;
};

/**
 * Link entries of the profile menu, in display order. Pure so the
 * "Admin only for admins" rule is testable without opening a Radix menu.
 */
export function profileMenuItems({
  isAdmin,
}: {
  isAdmin: boolean;
}): readonly ProfileMenuItem[] {
  const items: ProfileMenuItem[] = [
    { label: "Settings", href: "/settings", icon: Settings },
  ];
  if (isAdmin) {
    items.push({ label: "Admin", href: "/admin", icon: ShieldCheck });
  }
  return items;
}
