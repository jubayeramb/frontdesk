import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the demo banner is the first thing on the page", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByText("Demo business. No real bookings.");
  await expect(banner).toBeInViewport();
  expect((await banner.boundingBox())!.y).toBe(0);
  await expect(page.getByRole("heading", { name: "Triplone Tours", level: 1 })).toBeVisible();
});

test("the landing page describes the tours and sends prices to the chat", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("leaving from Dhaka")).toBeVisible();
  for (const name of ["Sundarbans 3-day boat tour", "Sylhet tea gardens 2-day", "Bandarban hills 3-day"]) {
    await expect(page.getByRole("heading", { name, level: 3 })).toBeVisible();
  }
  await expect(page.getByText("Ask the chat for a quote.")).toBeVisible();
  // No price table: prices live in the database and come from the chat.
  await expect(page.locator("main")).not.toContainText("৳");
  await expect(page.locator("main")).not.toContainText(/\d{1,3},\d{3}/);
});

test("the footer has the retention and privacy note", async ({ page }) => {
  await page.goto("/");
  const footer = page.locator("footer");
  await footer.scrollIntoViewIfNeeded();
  await expect(footer.getByText("Chats are stored for 7 days and then deleted.")).toBeVisible();
  await expect(footer.getByText("don't send personal details")).toBeVisible();
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`the page and the chat follow the ${colorScheme} system theme`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/");
    await page.screenshot({ path: testInfo.outputPath(`home-${colorScheme}.png`), fullPage: true });
    await page.getByRole("button", { name: "Chat with us" }).click();
    const chat = page.getByRole("dialog", { name: "Triplone Tours front desk" });
    await page.getByRole("textbox", { name: "Message" }).fill("price for the sundarbans tour for 2 people");
    await page.keyboard.press("Enter");
    await expect(chat.getByText("Want to see departures?")).toBeVisible();
    await page.getByRole("textbox", { name: "Message" }).fill("when does it leave?");
    await page.keyboard.press("Enter");
    await expect(chat.getByRole("group")).toBeVisible();

    const lightness = (selector: string) =>
      page.locator(selector).first().evaluate((el) => {
        // Computed colors come back as oklch(); a canvas turns them into RGB.
        const canvas = document.createElement("canvas").getContext("2d")!;
        canvas.fillStyle = getComputedStyle(el).backgroundColor;
        canvas.fillRect(0, 0, 1, 1);
        const [r, g, b] = canvas.getImageData(0, 0, 1, 1).data;
        return (r! + g! + b!) / 3;
      });
    for (const selector of ["body", "[role=dialog]"]) {
      if (colorScheme === "dark") expect(await lightness(selector)).toBeLessThan(60);
      else expect(await lightness(selector)).toBeGreaterThan(200);
    }

    const { violations } = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
    expect(violations.flatMap((v) => v.nodes.map((n) => n.target.join(" ")))).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`chat-${colorScheme}.png`) });
  });
}
