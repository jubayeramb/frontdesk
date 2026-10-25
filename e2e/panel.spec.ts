import { expect, test, type Page } from "@playwright/test";

import { addMessage, conversation, number, query, visit } from "./conversations";

async function openChat(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Chat with us" }).click();
  return page.getByRole("dialog", { name: "Triplone Tours front desk" });
}

test("a conversation that continued on WhatsApp shows both channels and keeps up without a reload", async ({ page, context }) => {
  const id = await conversation({
    whatsapp: number("4821"),
    rows: [
      { channel: "web", sentBy: "customer", body: "How much is the Sylhet tour for 2?" },
      { channel: "web", sentBy: "ai", body: "Sylhet tea gardens 2-day for 2 travelers: ৳17,000 total.", payload: { kind: "text", text: "Sylhet tea gardens 2-day for 2 travelers: ৳17,000 total." } },
      { channel: "whatsapp", sentBy: "system", body: "Customer continued from the website on WhatsApp.", payload: { kind: "linked" } },
      { channel: "whatsapp", sentBy: "customer", body: "Hi! My code is TR-7KQ2MX" },
    ],
  });
  await visit(context, id);
  const chat = await openChat(page);

  await expect(chat.getByTestId("chat-status")).toContainText("This chat continues on WhatsApp •••• 4821.");
  await expect(chat.getByTestId("chat-status").getByRole("link", { name: "Open WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/\d+$/);
  await expect(chat.getByText("Continued on WhatsApp")).toBeVisible();
  await expect(chat.getByText("On WhatsApp", { exact: true })).toHaveCount(1);

  await query(async (q) => {
    await addMessage(q, id, { channel: "whatsapp", sentBy: "ai", body: "Welcome back! Want the departures?", payload: { kind: "text", text: "Welcome back! Want the departures?" } });
    await addMessage(q, id, { channel: "whatsapp", sentBy: "human", body: "Hi, this is the team." });
  });
  await expect(chat.getByText("Welcome back! Want the departures?")).toBeVisible({ timeout: 10_000 });
  await expect(chat.getByText("Triplone Tours team · On WhatsApp")).toBeVisible();
});

test("while a person owns the conversation, a web message gets pointed to WhatsApp", async ({ page, context }) => {
  const id = await conversation({
    owner: "human",
    whatsapp: number("1111"),
    rows: [
      { channel: "whatsapp", sentBy: "customer", body: "can I talk to a person" },
      { channel: "whatsapp", sentBy: "system", body: "Handed to a person.", payload: { kind: "ownership", from: "ai", to: "human" } },
    ],
  });
  await visit(context, id);
  const chat = await openChat(page);
  await expect(chat.getByTestId("chat-status")).toContainText("A person from our team is answering on WhatsApp.");
  await expect(chat.getByText("A person joined")).toBeVisible();

  await page.getByRole("textbox", { name: "Message" }).fill("are you there?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(chat.getByText("Reply there to reach them.")).toBeVisible();
  await expect(chat.getByRole("link", { name: "Open WhatsApp" })).toHaveCount(2);
});

test("a message sent while the panel polls shows once", async ({ page }) => {
  const chat = await openChat(page);
  await page.getByRole("textbox", { name: "Message" }).fill("hello there");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(chat.getByText("Which one interests you?")).toBeVisible();

  // Two polls later, the server's copy has replaced the local one, not doubled it.
  await page.waitForTimeout(11_000);
  await expect(chat.getByText("hello there")).toHaveCount(1);
  await expect(chat.getByText("Which one interests you?")).toHaveCount(1);
});
