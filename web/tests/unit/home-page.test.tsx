// Smoke test for the `jsdom` Vitest project: React 19 + Testing Library +
// jest-dom matchers + the `@/` alias. Task 2.2 replaces the placeholder
// Home page and this test along with it.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("Home placeholder", () => {
  it("renders the Scholarly heading", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Scholarly" }),
    ).toBeInTheDocument();
  });
});
