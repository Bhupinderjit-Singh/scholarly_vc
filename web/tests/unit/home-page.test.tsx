import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/(app)/page";
import { HomeSections } from "@/components/home/home-sections";

describe("Home page", () => {
  it("renders the Home heading and description", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Home" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Study together, right now or on a schedule."),
    ).toBeInTheDocument();
  });

  it("offers Start now and Schedule as links into the session form", () => {
    render(<HomePage />);
    const startNow = screen.getByRole("link", { name: "Start now" });
    expect(startNow).toHaveAttribute("href", "/sessions/new?instant=1");
    expect(startNow).toHaveAccessibleDescription(
      "Open a live room and invite friends to join you.",
    );
    const schedule = screen.getByRole("link", { name: "Schedule" });
    expect(schedule).toHaveAttribute("href", "/sessions/new");
    expect(schedule).toHaveAccessibleDescription(
      "Pick a time and send invites ahead of the session.",
    );
  });

  it("renders the Live now, Upcoming and Pending invites sections", () => {
    render(<HomePage />);
    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(["Live now", "Upcoming", "Pending invites"]);
  });
});

describe("F1-R2.9 HomeSections empty states", () => {
  it("gives every section an explanation and a primary action", () => {
    render(<HomeSections />);

    const liveNow = screen.getByRole("region", { name: "Live now" });
    expect(
      within(liveNow).getByText(
        "Sessions that are live appear here so you can join with one click.",
      ),
    ).toBeInTheDocument();
    expect(
      within(liveNow).getByRole("link", { name: "Start a session" }),
    ).toHaveAttribute("href", "/sessions/new?instant=1");

    const upcoming = screen.getByRole("region", { name: "Upcoming" });
    expect(
      within(upcoming).getByRole("link", { name: "Schedule a session" }),
    ).toHaveAttribute("href", "/sessions/new");

    const invites = screen.getByRole("region", { name: "Pending invites" });
    expect(
      within(invites).getByRole("link", {
        name: "Invite friends to a session",
      }),
    ).toHaveAttribute("href", "/sessions/new");
  });

  it("uses distinct pastel surfaces: mint for live, sky for upcoming, lavender for invites", () => {
    render(<HomeSections />);
    const surfaceOf = (name: string): Element | null =>
      screen.getByRole("region", { name }).querySelector("div.rounded-xl");
    expect(surfaceOf("Live now")).toHaveClass("bg-mint");
    expect(surfaceOf("Upcoming")).toHaveClass("bg-sky");
    expect(surfaceOf("Pending invites")).toHaveClass("bg-lavender");
  });
});
