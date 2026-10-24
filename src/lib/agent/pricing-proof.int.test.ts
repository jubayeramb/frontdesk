import { expect, it } from "vitest";

import { seed } from "@/db/seed-data";
import { getConversation } from "@/lib/conversations/store";
import { updatePrices } from "@/lib/pricing/price-list";
import { setupTestDb } from "../../../test/int/db";
import { newConversation } from "../../../test/int/fixtures";
import { scriptedModel } from "../../../test/support/scripted-model";
import { runTurn } from "./run-turn";

const db = setupTestDb();
const now = new Date("2026-11-02T10:00:00+06:00");

// The reason prices live in the database: change one, and the very next
// quote in the same conversation uses it.
it("quotes the current price before and after a staff edit", async () => {
  await seed(db);
  const { id: conversationId } = await newConversation(db);

  async function askForQuote(answer: string) {
    const model = scriptedModel([
      { tools: [{ name: "getQuote", input: { tourSlug: "sundarbans", travelers: 4 } }] },
      { text: answer },
    ]);
    const replies = await runTurn({
      db,
      conversationId,
      channel: "web",
      inbound: { text: "How much is the Sundarbans tour for 4 people?" },
      now,
      models: [{ id: "mock", model }],
    });
    const toolResult = JSON.stringify(model.doGenerateCalls.at(-1)?.prompt.at(-1));
    return { replies, toolResult };
  }

  const before = await askForQuote("That's ৳58,000 for four.");
  expect(before.toolResult).toContain("৳58,000");
  expect(before.toolResult).toContain('"priceListVersion":1');
  expect(before.replies).toEqual([{ kind: "text", text: "That's ৳58,000 for four." }]);

  // Staff raise the price through the same function /staff/pricing uses.
  await updatePrices(db, [{ slug: "sundarbans", pricePerPersonBdt: 15_000, active: true }]);

  // A model that repeats the old total is caught by the price guard.
  const after = await askForQuote("Still ৳58,000 for four.");
  expect(after.toolResult).toContain("৳60,000");
  expect(after.toolResult).toContain('"priceListVersion":2');
  expect(after.toolResult).not.toContain("58,000");
  expect(after.replies).toEqual([
    { kind: "text", text: "Sundarbans 3-day boat tour for 4 travelers: ৳15,000 per person, ৳60,000 total." },
  ]);
  expect((await getConversation(db, conversationId))?.state.quote).toMatchObject({
    totalBdt: 60_000,
    priceListVersion: 2,
  });
});
