import { expect, test } from "@playwright/test";

import { CONTACT_LIMIT_REPLY } from "../src/lib/guards";
import { conversation, query, visit } from "./conversations";

test("a visitor over the hourly limit gets the limit reply in the chat", async ({ page, context }) => {
  const id = await conversation({ rows: [] });
  // 20 turns in the last hour, as if they had just been chatting.
  await query((q) =>
    q(
      `insert into turns (contact_id, conversation_id, model, created_at)
       select contact_id, id, 'primary', now() - make_interval(mins => n) from conversations, generate_series(1, 20) n where id = $1`,
      [id],
    ),
  );
  await visit(context, id);
  await page.goto("/");
  await page.getByRole("button", { name: "Chat with us" }).click();
  const chat = page.getByRole("dialog", { name: "Triplone Tours front desk" });
  const input = chat.getByRole("textbox", { name: "Message" });

  await input.fill("How much is the Sylhet tour for 2?");
  await input.press("Enter");

  await expect(chat.getByText(CONTACT_LIMIT_REPLY)).toBeVisible();
});
