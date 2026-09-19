import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BottomNav } from "@/components/shell/bottom-nav";
import {
  BOTTOM_NAV_ITEMS,
  isNavItemActive,
  NAV_ITEMS,
  PROFILE_NAV_ITEM,
} from "@/components/shell/nav-items";
import { TopNav } from "@/components/shell/top-nav";

const { pathnameMock } = vi.hoisted(() => ({
  pathnameMock: vi.fn<() => string>(() => "/"),
}));

vi.mock("next/navigation", () => ({
  usePathname: (): string => pathnameMock(),
}));

beforeEach(() => {
  pathnameMock.mockReturnValue("/");
});

function linkNames(nav: HTMLElement): string[] {
  return within(nav)
    .getAllByRole("link")
    .map((link) => link.textContent?.trim() ?? "");
}

describe("F1-R2.3 TopNav", () => {
  it("renders Home, Sessions and Calendar in order with their hrefs", () => {
    render(<TopNav />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(linkNames(nav)).toEqual(["Home", "Sessions", "Calendar"]);
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(within(nav).getByRole("link", { name: "Sessions" })).toHaveAttribute(
      "href",
      "/sessions",
    );
    expect(within(nav).getByRole("link", { name: "Calendar" })).toHaveAttribute(
      "href",
      "/calendar",
    );
  });

  it("does not include Profile; the profile menu covers it on desktop", () => {
    render(<TopNav />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).queryByRole("link", { name: "Profile" })).toBeNull();
  });

  it("marks only the current item with aria-current=page", () => {
    pathnameMock.mockReturnValue("/sessions/abc");
    render(<TopNav />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "Sessions" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(
      within(nav).getByRole("link", { name: "Calendar" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("marks Home current only on the root path", () => {
    render(<TopNav />);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("is hidden below the lg breakpoint", () => {
    render(<TopNav />);
    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveClass(
      "hidden",
      "lg:block",
    );
  });
});

describe("F1-R2.4 BottomNav", () => {
  it("renders Home, Sessions, Calendar and Profile in order", () => {
    render(<BottomNav />);
    const nav = screen.getByRole("navigation", { name: "Primary mobile" });
    expect(linkNames(nav)).toEqual(["Home", "Sessions", "Calendar", "Profile"]);
    expect(within(nav).getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/settings/profile",
    );
  });

  it("does not contain the notification bell; it stays in the header", () => {
    render(<BottomNav />);
    const nav = screen.getByRole("navigation", { name: "Primary mobile" });
    expect(
      within(nav).queryByRole("link", { name: "Notifications" }),
    ).toBeNull();
  });

  it("keeps Profile current anywhere under /settings", () => {
    pathnameMock.mockReturnValue("/settings/account");
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("is fixed to the bottom and hidden from the lg breakpoint up", () => {
    render(<BottomNav />);
    expect(
      screen.getByRole("navigation", { name: "Primary mobile" }),
    ).toHaveClass("fixed", "bottom-0", "lg:hidden");
  });
});

describe("nav-items", () => {
  it("shares the three primary items between both variants", () => {
    expect(BOTTOM_NAV_ITEMS).toEqual([...NAV_ITEMS, PROFILE_NAV_ITEM]);
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      "Home",
      "Sessions",
      "Calendar",
    ]);
  });

  it("matches Home exactly and other items by prefix", () => {
    const [home, sessions] = NAV_ITEMS;
    if (home === undefined || sessions === undefined) {
      throw new Error("NAV_ITEMS must contain Home and Sessions");
    }
    expect(isNavItemActive("/", home)).toBe(true);
    expect(isNavItemActive("/sessions", home)).toBe(false);
    expect(isNavItemActive("/sessions", sessions)).toBe(true);
    expect(isNavItemActive("/sessions/123/room", sessions)).toBe(true);
    expect(isNavItemActive("/sessionsx", sessions)).toBe(false);
    expect(isNavItemActive("/", sessions)).toBe(false);
  });

  it("uses activePrefix when it differs from href", () => {
    expect(isNavItemActive("/settings", PROFILE_NAV_ITEM)).toBe(true);
    expect(isNavItemActive("/settings/profile", PROFILE_NAV_ITEM)).toBe(true);
    expect(isNavItemActive("/settingsx", PROFILE_NAV_ITEM)).toBe(false);
  });
});
