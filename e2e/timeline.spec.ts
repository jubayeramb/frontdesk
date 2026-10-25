import { expect, test } from "@playwright/test";

import { CHAT_COOKIE } from "../src/lib/web-chat/cookie";
import { addMessage, conversation, number, query, visit } from "./conversations";

test("a linked conversation shows both channels in order, with the number masked", async ({ page, context }) => {
  const whatsapp = number("4821");
  const id = await conversation({
    whatsapp,
    rows: [
      { channel: "web", sentBy: "customer", body: "How much is the Sylhet tour for 2?" },
      { channel: "web", sentBy: "ai", body: "Sylhet tea gardens 2-day for 2 travelers: ৳17,000 total." },
      { channel: "whatsapp", sentBy: "system", body: "Customer continued from the website on WhatsApp.", payload: { kind: "linked" } },
      { channel: "whatsapp", sentBy: "customer", body: "Hi! My code is TR-7KQ2MX" },
      { channel: "whatsapp", sentBy: "ai", body: "Welcome back! Want to see the departures?" },
    ],
  });
  await visit(context, id);
  await page.goto("/c");

  const entries = page.getByTestId("timeline-entry");
  await expect(entries).toHaveCount(4);
  await expect(entries.nth(0)).toContainText("How much is the Sylhet tour for 2?");
  await expect(entries.nth(0)).toContainText("Web");
  await expect(entries.nth(3)).toContainText("Welcome back!");
  await expect(entries.nth(3)).toContainText("WhatsApp");
  await expect(page.getByText("Continued on WhatsApp")).toBeVisible();
  await expect(page.getByTestId("timeline-status")).toContainText("WhatsApp •••• 4821");
  expect(await page.content()).not.toContain(whatsapp.slice(0, -4));
});

test("a conversation a person owns says a person will reply", async ({ page, context }) => {
  const id = await conversation({
    owner: "human",
    whatsapp: number("1111"),
    rows: [
      { channel: "whatsapp", sentBy: "customer", body: "can I talk to a person" },
      { channel: "whatsapp", sentBy: "system", body: "Handed to a person.", payload: { kind: "ownership", from: "ai", to: "human" } },
      { channel: "whatsapp", sentBy: "human", body: "Hi, this is Jub from Triplone." },
    ],
  });
  await visit(context, id);
  await page.goto("/c");

  await expect(page.getByTestId("timeline-status")).toContainText("Person");
  await expect(page.getByTestId("timeline-status")).toContainText("A person will reply.");
  await expect(page.getByText("A person joined")).toBeVisible();
  await expect(page.getByTestId("timeline-entry").last()).toContainText("Triplone Tours team");
});

test("without a chat cookie there is nothing to show", async ({ page }) => {
  await page.goto("/c");
  await expect(page.getByText("No conversation yet")).toBeVisible();
  await page.getByRole("link", { name: "Start one in the chat" }).click();
  await expect(page.getByRole("dialog", { name: "Triplone Tours front desk" })).toBeVisible();
});

test("a forged cookie shows nothing", async ({ page, context }) => {
  const id = await conversation({ rows: [{ channel: "web", sentBy: "customer", body: "secret plans" }] });
  await context.addCookies([{ name: CHAT_COOKIE, value: `${id}.${"0".repeat(64)}`, url: test.info().project.use.baseURL! }]);
  await page.goto("/c");
  await expect(page.getByText("No conversation yet")).toBeVisible();
  await expect(page.getByText("secret plans")).toHaveCount(0);
});

test("a new message shows up without a reload", async ({ page, context }) => {
  const id = await conversation({ rows: [{ channel: "web", sentBy: "customer", body: "hello" }] });
  await visit(context, id);
  await page.goto("/c");
  await expect(page.getByTestId("timeline-entry")).toHaveCount(1);

  await query((q) => addMessage(q, id, { channel: "whatsapp", sentBy: "human", body: "Staff reply from the inbox" }));

  await expect(page.getByText("Staff reply from the inbox")).toBeVisible({ timeout: 10_000 });
});

test("a conversation on WhatsApp shows the time left in the reply window", async ({ page, context }) => {
  const id = await conversation({
    whatsapp: number("4821"),
    lastWroteHoursAgo: 21,
    rows: [{ channel: "whatsapp", sentBy: "customer", body: "Hi! My code is TR-7KQ2MX" }],
  });
  await visit(context, id);
  await page.goto("/c");

  await expect(page.getByTestId("reply-window")).toHaveText(/^Reply window: (3h|2h 59m) left$/);
});

test("a WhatsApp window that has passed shows as closed", async ({ page, context }) => {
  const id = await conversation({
    whatsapp: number("4821"),
    lastWroteHoursAgo: 30,
    rows: [{ channel: "whatsapp", sentBy: "customer", body: "Hi! My code is TR-7KQ2MX" }],
  });
  await visit(context, id);
  await page.goto("/c");

  await expect(page.getByTestId("reply-window")).toHaveText("Window closed");
});

test("a web-only conversation shows no reply window", async ({ page, context }) => {
  const id = await conversation({ rows: [{ channel: "web", sentBy: "customer", body: "Hello" }] });
  await visit(context, id);
  await page.goto("/c");

  await expect(page.getByTestId("timeline-status")).toBeVisible();
  await expect(page.getByTestId("reply-window")).toHaveCount(0);
});

test("the page renders on the server without errors, with and without a reply window", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let loads = 0;
  page.on("load", () => loads++);

  await page.goto("/c");
  const id = await conversation({
    whatsapp: number("4821"),
    lastWroteHoursAgo: 2,
    rows: [{ channel: "whatsapp", sentBy: "customer", body: "Hi! My code is TR-7KQ2MX" }],
  });
  await visit(context, id);
  await page.goto("/c");
  await expect(page.getByTestId("reply-window")).toBeVisible();
  await page.waitForTimeout(1_000);

  expect(errors).toEqual([]);
  expect(loads).toBe(2);
});
