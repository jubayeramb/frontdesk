import { expect, test, type Page } from "@playwright/test";

import { E2E_ENV } from "./env";

async function signIn(page: Page, password = E2E_ENV.STAFF_PASSWORD) {
  await page.getByLabel("Staff password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("staff pages need the password", async ({ page }) => {
  await page.goto("/staff/pricing");
  await expect(page).toHaveURL(/\/staff\/sign-in\?next=%2Fstaff%2Fpricing$/);
  await expect(page.getByText("Sundarbans")).toHaveCount(0);

  await signIn(page, "not-the-password");
  await expect(page.getByRole("alert").filter({ hasText: "Wrong password." })).toBeVisible();
  await expect(page).toHaveURL(/\/staff\/sign-in/);

  await signIn(page);
  await expect(page).toHaveURL(/\/staff\/pricing$/);
  await expect(page.getByRole("heading", { name: "Pricing" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/staff\/sign-in$/);
  await page.goto("/staff/pricing");
  await expect(page).toHaveURL(/\/staff\/sign-in/);
});

test("a forged session cookie does not get in", async ({ page, context, baseURL }) => {
  await context.addCookies([
    { name: "fd_staff", value: `${Date.now() + 60_000}.${"0".repeat(64)}`, url: `${baseURL}/staff` },
  ]);
  await page.goto("/staff/pricing");
  await expect(page).toHaveURL(/\/staff\/sign-in/);
});

test("staff edit a price and the version goes up", async ({ page }, testInfo) => {
  // Projects run in parallel on one database, so each edits its own tour.
  const tour = testInfo.project.name === "phone" ? "Bandarban hills 3-day" : "Sylhet tea gardens 2-day";
  const newPrice = testInfo.project.name === "phone" ? "12500" : "9000";

  await page.goto("/staff/pricing");
  await signIn(page);
  const version = Number(await page.getByTestId("price-list-version").textContent());

  const price = page.getByRole("textbox", { name: `${tour} price per person in taka` });
  await price.fill(newPrice);
  await page.getByRole("button", { name: "Save prices" }).click();
  await expect(page.getByText(/Saved\. Price list is now version \d+\./)).toBeVisible();

  await page.reload();
  await expect(price).toHaveValue(newPrice);
  expect(Number(await page.getByTestId("price-list-version").textContent())).toBeGreaterThan(version);
});

test("an invalid price is refused with a message on the field", async ({ page }) => {
  await page.goto("/staff/pricing");
  await signIn(page);

  const price = page.getByRole("textbox", { name: "Sundarbans 3-day boat tour price per person in taka" });
  await price.fill("-5");
  await page.getByRole("button", { name: "Save prices" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "The price must be more than zero." }),
  ).toBeVisible();
  await expect(price).toHaveAttribute("aria-invalid", "true");
  await expect(price).toHaveValue("-5");

  // Other tests edit other tours in parallel, so check this tour, not the version.
  await page.reload();
  await expect(price).toHaveValue("14500");
});

test("sign-in works before JavaScript loads", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/staff/sign-in");
  await expect(page.locator("form")).toHaveCount(1);
  await signIn(page);
  await expect(page).toHaveURL(/\/staff\/pricing$/);
  await context.close();
});
