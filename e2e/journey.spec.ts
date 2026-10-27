import { expect, test } from "@playwright/test";

import { createDb } from "../src/db/client";
import { findCode } from "../src/lib/linking";
import { departureCount } from "./departures";
import { E2E_ENV } from "./env";

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
  await expect(chips).toHaveCount(departureCount("sundarbans"));
  await chips.nth(1).click();

  await expect(chat.getByText(/You're booked\. Your reference is TR-\d{5}\./)).toBeVisible();
  await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "true");
});

test("a visitor with a quote gets a WhatsApp link with a fresh code", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Chat with us" }).click();
  const chat = page.getByRole("dialog", { name: "Triplone Tours front desk" });
  const input = chat.getByRole("textbox", { name: "Message" });

  await input.fill("How much is the Sylhet tour for 3 people?");
  await input.press("Enter");
  await expect(chat.getByText(/in total/)).toBeVisible();

  await input.fill("Can we continue on WhatsApp?");
  await input.press("Enter");
  const link = chat.getByRole("link", { name: "Continue on WhatsApp" });
  await expect(link).toBeVisible();

  const url = new URL((await link.getAttribute("href"))!);
  expect(url.origin + url.pathname).toBe(`https://wa.me/${E2E_ENV.NEXT_PUBLIC_WHATSAPP_NUMBER}`);
  const text = url.searchParams.get("text")!;
  expect(text).toMatch(/^Hi! My code is TR-[0-9A-Z]{6}$/);

  const { pool } = createDb(E2E_ENV.DATABASE_URL, E2E_ENV.DATABASE_WS_PROXY);
  try {
    const { rows } = await pool.query("select used_at, expires_at > now() as valid from link_codes where code = $1", [findCode(text)]);
    expect(rows).toEqual([{ used_at: null, valid: true }]);
  } finally {
    await pool.end();
  }
});
