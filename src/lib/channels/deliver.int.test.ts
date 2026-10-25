import { asc, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import type { Db } from "@/db/client";
import { messages } from "@/db/schema";
import type { AgentReply } from "@/lib/agent/replies";
import { toModelMessages } from "@/lib/agent/run-turn";
import { appendMessage, loadWindow, noteWhatsAppInbound } from "@/lib/conversations/store";
import { setupTestDb } from "../../../test/int/db";
import { newConversation } from "../../../test/int/fixtures";
import { fakeKapso } from "../../../test/support/fake-kapso";
import { deliverTurn } from "./deliver";
import { createWhatsAppAdapter } from "./whatsapp/adapter";

const db = setupTestDb();
const TO = "8801700000000";
const now = new Date("2026-11-02T10:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

// A WhatsApp conversation whose customer last wrote at `at`.
async function customerWrote(at: Date) {
  const conversation = await newConversation(db, "whatsapp");
  await noteWhatsAppInbound(db, conversation.id, { at });
  return conversation;
}

// Stores replies the way runTurn does, and returns the turn.
async function storedTurn(db: Db, conversationId: string, replies: AgentReply[]) {
  const messageIds: number[] = [];
  for (const reply of replies) {
    const row = await appendMessage(db, {
      conversationId,
      channel: "whatsapp",
      direction: "outbound",
      sentBy: "ai",
      body: reply.kind === "choices" ? reply.prompt : reply.text,
      payload: reply,
    });
    messageIds.push(row.id);
  }
  return { replies, messageIds };
}

async function rows(conversationId: string) {
  return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.id));
}

const departures: AgentReply = {
  kind: "choices",
  prompt: "Departures for Sundarbans 3-day boat tour",
  options: ["29", "1", "5", "8"].map((day) => ({ id: `sundarbans:2026-11-${day}`, label: `Thu ${day} Nov` })),
};

describe("deliverTurn", () => {
  it("sends each reply through Kapso and records the WhatsApp id and nonce", async () => {
    const kapso = fakeKapso();
    const adapter = createWhatsAppAdapter({ apiKey: "k", phoneNumberId: "1000000000000001", fetch: kapso.fetch });
    const conversation = await customerWrote(minutesAgo(1));
    const turn = await storedTurn(db, conversation.id, [{ kind: "text", text: "We leave on **Thursdays**." }, departures]);

    expect(await deliverTurn(db, adapter, { conversationId: conversation.id, to: TO, turn, now })).toEqual({ sent: 2, failed: 0, blocked: 0 });

    expect(kapso.sends[0]).toMatchObject({ to: TO, type: "text", text: { body: "We leave on Thursdays." } });
    expect(kapso.sends[1]).toMatchObject({
      to: TO,
      type: "interactive",
      interactive: { type: "list", action: { sections: [{ rows: expect.arrayContaining([{ id: "sundarbans:2026-11-29", title: "Thu 29 Nov" }]) }] } },
    });
    const stored = await rows(conversation.id);
    expect(stored.map((m) => [m.externalId, m.deliveryStatus])).toEqual([
      ["wamid.fake-1", "sent"],
      ["wamid.fake-2", "sent"],
    ]);
    // The nonce went out with the send, so Kapso's echo can be matched to it.
    expect(kapso.sends.map((s) => s.biz_opaque_callback_data)).toEqual(stored.map((m) => m.clientNonce));
    expect(stored.every((m) => m.clientNonce)).toBe(true);
  });

  it("marks a rejected send failed with the error code, sets no id, and skips the rest", async () => {
    const kapso = fakeKapso();
    kapso.failOn(0, 422, { error: "Cannot send non-template messages outside the 24-hour window" });
    const adapter = createWhatsAppAdapter({ apiKey: "k", phoneNumberId: "1000000000000001", fetch: kapso.fetch });
    const conversation = await customerWrote(minutesAgo(1));
    const turn = await storedTurn(db, conversation.id, [{ kind: "text", text: "Here you go." }, departures]);
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await deliverTurn(db, adapter, { conversationId: conversation.id, to: TO, turn, now })).toEqual({ sent: 0, failed: 2, blocked: 0 });

    expect(kapso.sends).toHaveLength(1);
    const [first, second] = await rows(conversation.id);
    expect(first).toMatchObject({ externalId: null, deliveryStatus: "failed", deliveryError: expect.stringMatching(/^422: /) });
    expect(second).toMatchObject({ externalId: null, deliveryStatus: "failed", deliveryError: expect.stringMatching(/^skipped/) });
  });

  it("sends a long reply as several messages, each recorded, without repeating it in history", async () => {
    const kapso = fakeKapso();
    const adapter = createWhatsAppAdapter({ apiKey: "k", phoneNumberId: "1000000000000001", fetch: kapso.fetch });
    const conversation = await customerWrote(minutesAgo(1));
    const text = Array.from({ length: 3 }, (_, i) => `Day ${i + 1}. ${"On the river. ".repeat(200).trim()}`).join("\n\n");
    const turn = await storedTurn(db, conversation.id, [{ kind: "text", text }]);

    const result = await deliverTurn(db, adapter, { conversationId: conversation.id, to: TO, turn, now });

    expect(result.sent).toBeGreaterThan(1);
    const stored = await rows(conversation.id);
    expect(stored).toHaveLength(result.sent);
    expect(stored.every((m) => m.deliveryStatus === "sent" && m.externalId)).toBe(true);
    expect(stored.slice(1).every((m) => m.payload?.continues === stored[0]!.id)).toBe(true);
    expect(toModelMessages(await loadWindow(db, conversation.id))).toHaveLength(1);
  });

  it("sends inside the 24-hour window", async () => {
    const kapso = fakeKapso();
    const adapter = createWhatsAppAdapter({ apiKey: "k", phoneNumberId: "1000000000000001", fetch: kapso.fetch });
    const conversation = await customerWrote(minutesAgo(23 * 60));
    const turn = await storedTurn(db, conversation.id, [{ kind: "text", text: "Still here." }]);

    expect(await deliverTurn(db, adapter, { conversationId: conversation.id, to: TO, turn, now })).toEqual({ sent: 1, failed: 0, blocked: 0 });
  });

  it("keeps every reply of a turn as blocked once the window has closed, and calls Kapso for none", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const kapso = fakeKapso();
    const adapter = createWhatsAppAdapter({ apiKey: "k", phoneNumberId: "1000000000000001", fetch: kapso.fetch });
    const conversation = await customerWrote(minutesAgo(24 * 60 + 5));
    const turn = await storedTurn(db, conversation.id, [{ kind: "text", text: "Here you go." }, departures]);

    expect(await deliverTurn(db, adapter, { conversationId: conversation.id, to: TO, turn, now })).toEqual({ sent: 0, failed: 0, blocked: 2 });

    expect(kapso.log).toHaveLength(0);
    expect((await rows(conversation.id)).map((m) => [m.deliveryStatus, m.deliveryError])).toEqual([
      ["blocked", "reply window closed"],
      ["blocked", "reply window closed"],
    ]);
  });
});
