import type { LucideIcon } from "lucide-react";
import { CalendarDays, House, UserRound, Video } from "lucide-react";

/** One primary navigation destination, shared by the top and bottom nav. */
export type NavItem = {
  /** Visible label; also the link's accessible name. */
  readonly label: string;
  readonly href: string;
  readonly icon: LucideIcon;
  /**
   * Path prefix that keeps the item highlighted on nested routes, when it
   * differs from `href` (Profile lives under `/settings`). Defaults to
   * `href`; Home matches only exactly.
   */
  readonly activePrefix?: string;
};

/** Items shown in the desktop top nav (F1-R2.3). */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Home", href: "/", icon: House },
  { label: "Sessions", href: "/sessions", icon: Video },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
];

/** Extra item of the mobile bottom nav; the profile menu covers it on desktop. */
export const PROFILE_NAV_ITEM: NavItem = {
  label: "Profile",
  href: "/settings/profile",
  icon: UserRound,
  activePrefix: "/settings",
};

/** Items shown in the mobile bottom nav (F1-R2.4). */
export const BOTTOM_NAV_ITEMS: readonly NavItem[] = [
  ...NAV_ITEMS,
  PROFILE_NAV_ITEM,
];

/**
 * Whether `item` represents the current page. Home is active only on `/`;
 * every other item is active on its prefix and on routes nested under it,
 * so `/sessions/123` highlights Sessions.
 */
export function isNavItemActive(pathname: string, item: NavItem): boolean {
  const prefix = item.activePrefix ?? item.href;
  if (prefix === "/") {
    return pathname === "/";
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
