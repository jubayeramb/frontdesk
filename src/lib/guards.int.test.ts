import { describe, expect, it } from "vitest";

import { contacts, turns } from "@/db/schema";
import { runTurn } from "@/lib/agent/run-turn";
import { transition } from "@/lib/ownership";
import { CONTACT_LIMIT_REPLY, GLOBAL_LIMIT_REPLY, checkGuards, type Limits } from "./guards";
import { setupTestDb } from "../../test/int/db";
import { newConversation } from "../../test/int/fixtures";
import { scriptedModel } from "../../test/support/scripted-model";

const db = setupTestDb();
const now = new Date("2026-11-02T10:00:00Z");
const limits: Limits = { perHour: 20, perDay: 60, globalPerDay: 250 };
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

// Turns already used by a conversation's contact, at the given times.
async function used(conversation: { id: string; contactId: string }, times: Date[]) {
  await db.insert(turns).values(times.map((createdAt) => ({ contactId: conversation.contactId, conversationId: conversation.id, model: "primary", createdAt })));
}

describe("recording turns", () => {
  it("writes one row per turn with the model and its token counts", async () => {
    const conversation = await newConversation(db, "whatsapp");
    const model = scriptedModel([{ text: "Hi! Which tour are you thinking of?" }]);

    await runTurn({ db, conversationId: conversation.id, channel: "whatsapp", inbound: { text: "hi" }, now, models: [{ id: "primary", model }] });

    expect(await db.select().from(turns)).toEqual([
      expect.objectContaining({
        contactId: conversation.contactId,
        conversationId: conversation.id,
        model: "primary",
        inputTokens: 10,
        outputTokens: 5,
      }),
    ]);
  });

  it("writes no row when the model is not called", async () => {
    const conversation = await newConversation(db, "whatsapp");
    await transition(db, { conversationId: conversation.id, event: "customer_requested" });
    const model = scriptedModel([{ text: "unused" }]);

    await runTurn({ db, conversationId: conversation.id, channel: "whatsapp", inbound: { text: "hi" }, now, models: [{ id: "primary", model }] });
    await runTurn({
      db,
      conversationId: (await newConversation(db, "whatsapp")).id,
      channel: "whatsapp",
      inbound: { text: "[image]", unsupported: "image" },
      now,
      models: [{ id: "primary", model }],
    });

    expect(await db.select().from(turns)).toEqual([]);
  });
});

describe("checkGuards", () => {
  it("runs a turn under every limit", async () => {
    const conversation = await newConversation(db);
    await used(conversation, Array.from({ length: 19 }, (_, i) => minutesAgo(i + 1)));
    expect(await checkGuards(db, { conversation, unsupported: false, now, limits })).toEqual({ action: "run" });
  });

  it("stops the 21st turn in a rolling hour, once, then stays quiet", async () => {
    const conversation = await newConversation(db);
    await used(conversation, Array.from({ length: 20 }, (_, i) => minutesAgo(i + 1)));

    expect(await checkGuards(db, { conversation, unsupported: false, now, limits })).toEqual({ action: "reply", text: CONTACT_LIMIT_REPLY });
    for (let i = 0; i < 10; i++) {
      expect(await checkGuards(db, { conversation, unsupported: false, now, limits })).toEqual({ action: "silent" });
    }
  });

  it("counts the hour across midnight UTC", async () => {
    const conversation = await newConversation(db);
    const justAfterMidnight = new Date("2026-11-02T00:10:00Z");
    await used(conversation, Array.from({ length: 20 }, (_, i) => new Date(justAfterMidnight.getTime() - (i + 1) * 2 * 60_000)));
    expect(await checkGuards(db, { conversation, unsupported: false, now: justAfterMidnight, limits })).toMatchObject({ action: "reply" });
  });

  it("lets turns run again once the hour has passed, and tells a contact who hits it again", async () => {
    const conversation = await newConversation(db);
    await used(conversation, Array.from({ length: 20 }, (_, i) => minutesAgo(61 + i)));
    await db.update(contacts).set({ limitNotifiedAt: minutesAgo(60) });
    expect(await checkGuards(db, { conversation, unsupported: false, now, limits })).toEqual({ action: "run" });

    await used(conversation, Array.from({ length: 20 }, (_, i) => minutesAgo(i + 1)));
    expect(await checkGuards(db, { conversation, unsupported: false, now, limits })).toEqual({ action: "reply", text: CONTACT_LIMIT_REPLY });
  });

  it("stops a contact at 60 turns in a UTC day", async () => {
    const conversation = await newConversation(db);
    await used(conversation, Array.from({ length: 60 }, (_, i) => minutesAgo(61 + i * 5)));
    expect(await checkGuards(db, { conversation, unsupported: false, now, limits })).toEqual({ action: "reply", text: CONTACT_LIMIT_REPLY });
  });

  it("does not count yesterday toward the day", async () => {
    const conversation = await newConversation(db);
    await used(conversation, Array.from({ length: 60 }, (_, i) => new Date(Date.UTC(2026, 10, 1, 12, i))));
    expect(await checkGuards(db, { conversation, unsupported: false, now, limits })).toEqual({ action: "run" });
  });

  it("stops a new contact once everyone together has reached the cap", async () => {
    const busy = await newConversation(db);
    await used(busy, [minutesAgo(90), minutesAgo(80), minutesAgo(70)]);
    const newcomer = await newConversation(db, "whatsapp");
    const small = { ...limits, globalPerDay: 3 };

    expect(await checkGuards(db, { conversation: newcomer, unsupported: false, now, limits: small })).toEqual({ action: "reply", text: GLOBAL_LIMIT_REPLY });
    expect(await checkGuards(db, { conversation: newcomer, unsupported: false, now, limits: small })).toEqual({ action: "silent" });
  });

  it("gives two messages at once a single limit reply", async () => {
    const conversation = await newConversation(db);
    await used(conversation, Array.from({ length: 20 }, (_, i) => minutesAgo(i + 1)));
    const results = await Promise.all([1, 2, 3].map(() => checkGuards(db, { conversation, unsupported: false, now, limits })));
    expect(results.filter((r) => r.action === "reply")).toHaveLength(1);
  });
});
