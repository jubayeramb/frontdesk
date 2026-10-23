import { expect, test } from "@playwright/test";

test("home page shows the demo banner", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Demo business. No real bookings.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Mopwell Cleaning" }),
  ).toBeVisible();
});
