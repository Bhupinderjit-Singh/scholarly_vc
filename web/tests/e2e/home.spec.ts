import { expect, test } from "@playwright/test";

test("home page renders the Scholarly placeholder", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Scholarly");
  await expect(
    page.getByRole("heading", { level: 1, name: "Scholarly" }),
  ).toBeVisible();
});
