import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { getInitials } from "@/components/shell/initials";
import { ProfileMenu } from "@/components/shell/profile-menu";
import { profileMenuItems } from "@/components/shell/profile-menu-items";
import type { ShellUser } from "@/components/shell/types";

const user: ShellUser = {
  id: "user_1",
  displayName: "Ada Lovelace",
  username: "ada",
  image: null,
  emailVerified: true,
};

/**
 * jsdom keeps the Document as its "last focused" node once the focused
 * element is removed (which `cleanup()` does after a test leaves a menu
 * open). The next `element.focus()` then fires `blur` on `window`, and Radix
 * Menu closes on window blur, so the second menu opened in a file would
 * close right after opening. Focusing and blurring a throwaway element
 * clears that state.
 */
function resetJsdomFocus(): void {
  const probe = document.createElement("button");
  document.body.append(probe);
  probe.focus();
  probe.blur();
  probe.remove();
}

beforeEach(resetJsdomFocus);

describe("ProfileMenu", () => {
  it("renders a Sign in link and no menu while signed out", () => {
    render(<ProfileMenu user={null} isAdmin={false} />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    expect(screen.queryByRole("button", { name: "Account menu" })).toBeNull();
  });

  it("shows the avatar initials as the trigger while signed in", () => {
    render(<ProfileMenu user={user} isAdmin={false} />);
    const trigger = screen.getByRole("button", { name: "Account menu" });
    expect(trigger).toHaveTextContent("AL");
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });

  it("opens with Settings and Sign out, and no Admin entry for students", async () => {
    const events = userEvent.setup();
    render(<ProfileMenu user={user} isAdmin={false} />);

    await events.click(screen.getByRole("button", { name: "Account menu" }));

    const menu = await screen.findByRole("menu");
    expect(menu).toHaveTextContent("Ada Lovelace");
    expect(menu).toHaveTextContent("@ada");
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    expect(screen.queryByRole("menuitem", { name: "Admin" })).toBeNull();
  });

  it("adds the Admin entry for admins", async () => {
    const events = userEvent.setup();
    render(<ProfileMenu user={user} isAdmin={true} />);

    await events.click(screen.getByRole("button", { name: "Account menu" }));

    await screen.findByRole("menu");
    expect(screen.getByRole("menuitem", { name: "Admin" })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent?.trim()),
    ).toEqual(["Settings", "Admin", "Sign out"]);
  });
});

describe("profileMenuItems", () => {
  it("lists Settings only for students", () => {
    expect(profileMenuItems({ isAdmin: false }).map((i) => i.label)).toEqual([
      "Settings",
    ]);
  });

  it("lists Settings then Admin for admins", () => {
    const items = profileMenuItems({ isAdmin: true });
    expect(items.map((i) => [i.label, i.href])).toEqual([
      ["Settings", "/settings"],
      ["Admin", "/admin"],
    ]);
  });
});

describe("getInitials", () => {
  it("takes the first letters of the first and last words", () => {
    expect(getInitials("Ada Lovelace")).toBe("AL");
    expect(getInitials("Jean Luc Picard")).toBe("JP");
  });

  it("uses a single letter for one-word names and upper-cases", () => {
    expect(getInitials("ada")).toBe("A");
  });

  it("falls back to ? for blank names", () => {
    expect(getInitials("")).toBe("?");
    expect(getInitials("   ")).toBe("?");
  });

  it("does not split characters outside the BMP", () => {
    expect(getInitials("😀 Smith")).toBe("😀S");
  });
});
