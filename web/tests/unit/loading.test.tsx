import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomeLoading from "@/app/(app)/loading";
import SettingsLoading from "@/app/(app)/settings/loading";

function skeletons(container: HTMLElement): NodeListOf<Element> {
  return container.querySelectorAll('[data-slot="skeleton"]');
}

describe("F1-R2.5 HomeLoading", () => {
  it("renders skeleton placeholders without props and announces loading", () => {
    const { container } = render(<HomeLoading />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading Home")).toHaveClass("sr-only");
    expect(skeletons(container).length).toBeGreaterThan(0);
  });

  it("mirrors the Home layout: header, two action cards, three sections", () => {
    const { container } = render(<HomeLoading />);
    // Header (2) + action cards (2) + three sections × (heading + card) (6).
    expect(skeletons(container)).toHaveLength(10);
    expect(screen.queryByRole("heading")).toBeNull();
  });
});

describe("F1-R2.5 SettingsLoading", () => {
  it("renders skeleton placeholders without props and announces loading", () => {
    const { container } = render(<SettingsLoading />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading settings")).toHaveClass("sr-only");
    expect(skeletons(container).length).toBeGreaterThan(0);
  });

  it("mirrors a settings form card: title, four fields, one button", () => {
    const { container } = render(<SettingsLoading />);
    // Title + description (2) + four fields × (label + control) (8) + button (1).
    expect(skeletons(container)).toHaveLength(11);
    expect(container.querySelector('[data-slot="card"]')).not.toBeNull();
  });
});
