import { expect, test } from "@playwright/test";

// The plan's web journey: a quote from the seeded price list, then booking a departure.
test("a visitor gets a quote and books a departure", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Chat with us" }).click();
  const chat = page.getByRole("dialog", { name: "Triplone Tours front desk" });
  const input = chat.getByRole("textbox", { name: "Message" });

  await input.fill("How much is the Sundarbans tour for 2 people?");
  await input.press("Enter");
  // ৳14,500 per person in the seed, worked out by the quote tool.
  await expect(chat.getByText("৳29,000 in total (৳14,500 each)")).toBeVisible();

  await input.fill("When does it leave?");
  await input.press("Enter");
  const chips = chat.getByRole("group", { name: "Departures for Sundarbans 3-day boat tour" }).getByRole("button");
  await expect(chips).toHaveCount(4);
  await chips.nth(1).click();

  await expect(chat.getByText(/You're booked\. Your reference is TR-\d{5}\./)).toBeVisible();
  await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "true");
});
