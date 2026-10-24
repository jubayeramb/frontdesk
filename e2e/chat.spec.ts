import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function openChat(page: Page) {
  await page.getByRole("button", { name: "Chat with us" }).click();
  return page.getByRole("dialog", { name: "Triplone Tours front desk" });
}

async function say(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Message" }).fill(text);
  await page.getByRole("button", { name: "Send" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("a visitor sends a message and gets a reply", async ({ page }) => {
  const chat = await openChat(page);
  await say(page, "hello there");

  await expect(chat.getByText("hello there")).toBeVisible();
  await expect(chat.getByRole("status", { name: "Front desk is typing" })).toBeVisible();
  await expect(chat.getByText("Which one interests you?")).toBeVisible();
  await expect(chat.getByRole("status", { name: "Front desk is typing" })).toHaveCount(0);
  // The reply's **bold** renders as bold, not as asterisks.
  await expect(chat.locator("strong", { hasText: "Sundarbans" })).toBeVisible();
});

test("departures show as chips, and a pick sends it and disables the rest", async ({ page }) => {
  const chat = await openChat(page);
  await say(page, "when does the sundarbans tour leave?");

  const chips = chat.getByRole("group", { name: "Departures for Sundarbans 3-day boat tour" }).getByRole("button");
  await expect(chips).toHaveCount(4);
  const label = (await chips.first().textContent())!;
  await chips.first().click();

  // The pick is the visitor's next message.
  await expect(chat.locator("p", { hasText: label }).last()).toBeVisible();
  await expect(chips.first()).toHaveAttribute("aria-pressed", "true");
  for (const chip of await chips.all()) await expect(chip).toBeDisabled();
  // No quote yet, so the agent says so instead of booking.
  await expect(chat.getByText("There is no quote yet")).toBeVisible();
});

test("a link reply renders as a button that opens the URL", async ({ page }) => {
  await page.route("/api/chat", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      json: {
        conversationId: "00000000-0000-4000-8000-000000000000",
        replies: [{ kind: "link", text: "You can carry on in WhatsApp.", url: "https://example.com/wa", label: "Open WhatsApp" }],
      },
    });
  });
  const chat = await openChat(page);
  await say(page, "can we move to whatsapp?");

  await expect(chat.getByText("You can carry on in WhatsApp.")).toBeVisible();
  const link = chat.getByRole("link", { name: "Open WhatsApp" });
  await expect(link).toHaveAttribute("href", "https://example.com/wa");
  await expect(link).toHaveAttribute("target", "_blank");
});

test("a failed send says so, and a retry sends the same message once", async ({ page }) => {
  const nonces: string[] = [];
  let failNext = true;
  await page.route("/api/chat", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    nonces.push((route.request().postDataJSON() as { nonce: string }).nonce);
    if (failNext) {
      failNext = false;
      return route.abort("connectionfailed");
    }
    return route.continue();
  });
  const chat = await openChat(page);
  await say(page, "is anyone there?");

  await expect(chat.getByText("Couldn't send. Try again.")).toBeVisible();
  await expect(chat.getByText("is anyone there?")).toBeVisible();
  await chat.getByRole("button", { name: "Retry" }).click();

  await expect(chat.getByText("Which one interests you?")).toBeVisible();
  await expect(chat.getByText("Couldn't send. Try again.")).toHaveCount(0);
  await expect(chat.getByText("is anyone there?")).toHaveCount(1);
  expect(nonces).toHaveLength(2);
  expect(nonces[1]).toBe(nonces[0]);
});

test("a quote survives a reload, and the agent still knows the tour", async ({ page }) => {
  let chat = await openChat(page);
  await say(page, "price for the sundarbans tour for 3 people");
  await expect(chat.getByText("৳43,500 in total")).toBeVisible();

  await page.reload();
  chat = await openChat(page);
  await expect(chat.getByText("price for the sundarbans tour for 3 people")).toBeVisible();
  await expect(chat.getByText("৳43,500 in total")).toBeVisible();

  await say(page, "when does it leave?");
  await expect(chat.getByRole("group", { name: "Departures for Sundarbans 3-day boat tour" })).toBeVisible();
});

test("the chat works with the keyboard alone", async ({ page }) => {
  const bubble = page.getByRole("button", { name: "Chat with us" });
  for (let i = 0; i < 30 && !(await bubble.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect(bubble).toBeFocused();
  await page.keyboard.press("Enter");

  const chat = page.getByRole("dialog", { name: "Triplone Tours front desk" });
  const input = chat.getByRole("textbox", { name: "Message" });
  await expect(input).toBeFocused();
  await page.keyboard.type("hello");
  await page.keyboard.press("Enter");
  await expect(chat.getByText("Which one interests you?")).toBeVisible();
  await expect(input).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(chat).toBeHidden();
  await expect(bubble).toBeFocused();
});

test("new replies are announced to screen readers", async ({ page }) => {
  const chat = await openChat(page);
  await say(page, "hello");
  await expect(chat.getByText("Which one interests you?")).toBeVisible();
  await expect(page.locator("[aria-live=polite]")).toContainText("Which one interests you?");
});

test("the page and the open chat have no serious accessibility violations", async ({ page }) => {
  const chat = await openChat(page);
  await say(page, "when does the sylhet tour leave?");
  await expect(chat.getByRole("group")).toBeVisible();

  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});

test("at 360px the panel fills the screen and nothing scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const chat = await openChat(page);
  await say(page, "when does the bandarban tour leave?");
  await expect(chat.getByRole("group")).toBeVisible();

  const box = (await chat.boundingBox())!;
  expect([box.x, box.y, box.width, box.height]).toEqual([0, 0, 360, 740]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
