// Setup for the `jsdom` Vitest project: jest-dom matchers on `expect`
// and DOM cleanup between tests (Vitest globals are off, so Testing
// Library cannot register its own afterEach hook).
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
