import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/shell/app-shell";
import type { ShellUser } from "@/components/shell/types";

vi.mock("next/navigation", () => ({
  usePathname: (): string => "/",
}));

const user: ShellUser = {
  id: "user_1",
  displayName: "Ada Lovelace",
  username: "ada",
  image: null,
  emailVerified: true,
};

describe("AppShell", () => {
  it("renders the skip link, header, main landmark, footer and both navs", () => {
    render(
      <AppShell user={null} isAdmin={false}>
        <p>Page content</p>
      </AppShell>,
    );

    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveAttribute("href", "#main");
    expect(screen.getByRole("banner")).toBeInTheDocument();
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main");
    expect(within(main).getByText("Page content")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Primary mobile" }),
    ).toBeInTheDocument();
  });

  it("keeps the bell and the account control in the header", () => {
    render(
      <AppShell user={user} isAdmin={false}>
        <p>Page content</p>
      </AppShell>,
    );
    const header = screen.getByRole("banner");
    expect(
      within(header).getByRole("link", { name: "Notifications" }),
    ).toHaveAttribute("href", "/notifications");
    expect(
      within(header).getByRole("button", { name: "Account menu" }),
    ).toBeInTheDocument();
    expect(
      within(header).getByRole("link", { name: "Scholarly" }),
    ).toHaveAttribute("href", "/");
  });

  it("offers Sign in instead of the account menu while signed out", () => {
    render(
      <AppShell user={null} isAdmin={false}>
        <p>Page content</p>
      </AppShell>,
    );
    const header = screen.getByRole("banner");
    expect(
      within(header).getByRole("link", { name: "Sign in" }),
    ).toHaveAttribute("href", "/sign-in");
    expect(
      within(header).queryByRole("button", { name: "Account menu" }),
    ).toBeNull();
  });

  it("links the privacy and terms pages from the footer", () => {
    render(
      <AppShell user={null} isAdmin={false}>
        <p>Page content</p>
      </AppShell>,
    );
    const footer = screen.getByRole("contentinfo");
    expect(
      within(footer).getByRole("link", { name: "Privacy" }),
    ).toHaveAttribute("href", "/privacy");
    expect(within(footer).getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/terms",
    );
  });

  it("reserves space for the fixed bottom nav on small screens", () => {
    const { container } = render(
      <AppShell user={null} isAdmin={false}>
        <p>Page content</p>
      </AppShell>,
    );
    expect(container.firstElementChild).toHaveClass("pb-20", "lg:pb-0");
  });
});
