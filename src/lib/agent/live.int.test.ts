import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { seed } from "@/db/seed-data";
import { getConversation } from "@/lib/conversations/store";
import { updatePrices } from "@/lib/pricing/price-list";
import { setupTestDb } from "../../../test/int/db";
import { newConversation } from "../../../test/int/fixtures";
import { FALLBACK_MODEL_ID, groqModels, PRIMARY_MODEL_ID } from "./model";
import { findAmounts } from "./price-guard";
import type { AgentReply } from "./replies";
import { runTurn } from "./run-turn";

// Opt-in: LIVE_LLM=1 pnpm test:int src/lib/agent/live.int.test.ts
// Calls Groq for real on each model. Uses GROQ_API_KEY from the env or .env.local.
const LIVE = process.env.LIVE_LLM === "1";
const apiKey =
  process.env.GROQ_API_KEY ??
  (existsSync(".env.local") ? parseEnv(readFileSync(".env.local", "utf8")).GROQ_API_KEY : undefined);

const db = setupTestDb();
const now = new Date("2026-11-02T10:00:00+06:00");
const text = (replies: AgentReply[]) => replies.map((r) => (r.kind === "choices" ? r.prompt : r.text)).join("\n");

describe.skipIf(!LIVE)("live Groq", () => {
  const all = apiKey ? groqModels(apiKey) : [];
  // Each model allows ~8,000 tokens a minute; space the turns out.
  afterEach(() => new Promise((resolve) => setTimeout(resolve, 15_000)), 20_000);

  for (const modelId of [PRIMARY_MODEL_ID, FALLBACK_MODEL_ID]) {
    describe(modelId, () => {
      const models = all.filter((m) => m.id === modelId);
      const usage: { inputTokens: number; outputTokens: number; steps: number }[] = [];
      const ask = (conversationId: string, message: string) =>
        runTurn({
          db,
          conversationId,
          channel: "web",
          inbound: { text: message },
          now,
          models,
          onModelResult: (info) => usage.push(info),
        });

      it("quotes the database price, then the new price after a staff edit", async () => {
        await seed(db);
        const { id } = await newConversation(db);

        const before = text(await ask(id, "How much is the Sundarbans tour for 4 people?"));
        expect(before).toContain("58,000");
        expect((await getConversation(db, id))?.state.quote?.priceListVersion).toBe(1);

        await updatePrices(db, [{ slug: "sundarbans", pricePerPersonBdt: 15_000, active: true }]);

        const after = text(await ask(id, "Prices may have changed. Can you quote the same trip again?"));
        expect(after).toContain("60,000");
        expect(after).not.toContain("58,000");
        expect((await getConversation(db, id))?.state.quote?.priceListVersion).toBe(2);

        console.log(`${modelId} usage per turn:`, JSON.stringify(usage));
      }, 60_000);

      it("declines an off-topic request without calling tools", async () => {
        await seed(db);
        const { id } = await newConversation(db);
        const replies = await ask(id, "Write me a short poem about the sea.");
        console.log(`${modelId} off-topic:`, JSON.stringify(replies));
        expect(replies).toHaveLength(1);
        expect(replies[0]?.kind).toBe("text");
        expect(text(replies)).toMatch(/Triplone|tour/i);
        expect(text(replies)).not.toMatch(/\bwaves?\b.*\n.*\n/i);
      }, 60_000);

      it("asks for details instead of guessing a price", async () => {
        await seed(db);
        const { id } = await newConversation(db);
        const replies = await ask(id, "How much is a tour?");
        const reply = text(replies);
        console.log(`${modelId} on "How much is a tour?":`, JSON.stringify(replies));
        // Listing the price list is fine; inventing a total is not. Every
        // amount must be a real per-person price, and it must ask a question.
        for (const amount of findAmounts(reply)) expect([14_500, 8_500, 12_000]).toContain(amount);
        expect(reply).toContain("?");
      }, 60_000);
    });
  }
});
