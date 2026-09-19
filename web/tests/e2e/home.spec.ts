import { expect, test } from "@playwright/test";

test("home page renders the app shell and its empty states", async ({
  page,
}) => {
  await page.goto("/");
  // `proxy.ts` sends visitors without a session cookie to /sign-in
  // (F1-R9.5). Until the sign-in flow (task 4.4) provides an authenticated
  // storage state for e2e runs, Home cannot be reached here.
  test.skip(
    new URL(page.url()).pathname === "/sign-in",
    "Home requires a signed-in session; add an auth fixture in task 4.4",
  );

  await expect(page).toHaveTitle("Scholarly");
  await expect(
    page.getByRole("heading", { level: 1, name: "Home" }),
  ).toBeVisible();
  // Desktop Chrome is wider than 1024 px, so the top nav is the visible one.
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Primary mobile" }),
  ).toBeHidden();
  await expect(
    page.getByRole("heading", { level: 2, name: "Live now" }),
  ).toBeVisible();
});
