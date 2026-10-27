import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the header's How it works link opens the write-up", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "How it works" }).click();
  await expect(page).toHaveURL(/\/how-it-works$/);
  await expect(page.getByRole("heading", { name: "How Front Desk works", level: 1 })).toBeVisible();
});

test("the page shows the diagram and a section for each part of the design", async ({ page }) => {
  await page.goto("/how-it-works");
  await expect(page.getByText("Demo business. No real bookings.")).toBeInViewport();

  const diagram = page.getByRole("img", { name: /agent core/ });
  await expect(diagram).toBeVisible();
  expect(await diagram.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  for (const name of [
    "One agent, two channels",
    "Prices come from the database",
    "The webhook pipeline",
    "Handing off to a person",
    "The 24-hour reply window",
  ]) {
    await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
  }
});

test("the Kapso section lists real issues with what was done about each", async ({ page }) => {
  await page.goto("/how-it-works");
  const section = page.getByRole("region", { name: "What tripped me up on Kapso" });
  const items = section.getByRole("listitem");
  expect(await items.count()).toBeGreaterThanOrEqual(3);
  for (const item of await items.all()) await expect(item).toContainText("What I did:");
  await expect(section).toContainText("An inbox reply looks the same as an API send");
});

test("the page links back to the demo and the repository", async ({ page }) => {
  await page.goto("/how-it-works");
  const main = page.getByRole("main");
  await expect(main.getByRole("region", { name: "Trying it on WhatsApp" }).getByRole("link", { name: "jubayeramb@gmail.com" })).toHaveAttribute(
    "href",
    "mailto:jubayeramb@gmail.com",
  );
  await expect(main.getByRole("link", { name: "Try the demo", exact: true })).toHaveAttribute("href", "/");
  await expect(main.getByRole("link", { name: "code on GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/jubayeramb/frontdesk",
  );
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`the page reads at 360px in the ${colorScheme} theme`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ colorScheme });
    await page.goto("/how-it-works");
    await expect(page.getByRole("img", { name: /agent core/ })).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    const { violations } = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
    expect(violations.flatMap((v) => v.nodes.map((n) => n.target.join(" ")))).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`how-it-works-${colorScheme}.png`), fullPage: true });
  });
}
