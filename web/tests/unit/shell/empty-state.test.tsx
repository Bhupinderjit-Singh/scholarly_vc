import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/shell/empty-state";

describe("F1-R2.9 EmptyState", () => {
  it("shows the title, a one-sentence explanation and the primary action link", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No sessions yet"
        description="Sessions you host or join will show up here."
        action={{ label: "Start a session", href: "/sessions/new" }}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 3, name: "No sessions yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Sessions you host or join will show up here."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Start a session" }),
    ).toHaveAttribute("href", "/sessions/new");
  });

  it("renders a custom action node as-is", () => {
    render(
      <EmptyState
        title="Nothing here"
        description="Try again later."
        action={<button type="button">Refresh</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders without an icon or action", () => {
    const { container } = render(
      <EmptyState title="Quiet" description="Nothing to show." />,
    );
    expect(screen.getByRole("heading", { name: "Quiet" })).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("uses a pastel surface with the requested tone and ink text", () => {
    render(
      <EmptyState tone="mint" title="Live" description="Nobody is live." />,
    );
    const surface = screen
      .getByRole("heading", { name: "Live" })
      .closest("div.rounded-xl");
    expect(surface).toHaveClass("bg-mint");
    expect(screen.getByRole("heading", { name: "Live" })).toHaveClass(
      "text-ink",
    );
  });

  it("defaults to lavender and can render a level-2 heading", () => {
    render(
      <EmptyState headingLevel="h2" title="Page level" description="Empty." />,
    );
    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Page level",
    });
    expect(heading.closest("div.rounded-xl")).toHaveClass("bg-lavender");
  });
});
