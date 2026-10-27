import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { channelIdentities, contacts, conversations } from "@/db/schema";
import type { Quote } from "@/lib/pricing/quote";
import { setupTestDb } from "../../../test/int/db";
import {
  appendMessage,
  findConversation,
  findOrCreateConversation,
  getConversation,
  loadWindow,
  updateState,
} from "./store";

const db = setupTestDb();

const quote = (totalBdt: number, version: number): Quote => ({
  tour: { slug: "sundarbans", name: "Sundarbans 3-day boat tour" },
  pricePerPersonBdt: totalBdt / 2,
  travelers: 2,
  totalBdt,
  priceListVersion: version,
});

describe("findOrCreateConversation", () => {
  it("reuses the contact and open conversation when the same number writes again", async () => {
    const first = await findOrCreateConversation(db, { channel: "whatsapp", externalId: "8801700000000" });
    const second = await findOrCreateConversation(db, { channel: "whatsapp", externalId: "8801700000000" });
    expect(second.id).toBe(first.id);
    expect(await db.select().from(contacts)).toHaveLength(1);
  });

  it("keeps the same external id on different channels apart", async () => {
    const wa = await findOrCreateConversation(db, { channel: "whatsapp", externalId: "abc" });
    const web = await findOrCreateConversation(db, { channel: "web", externalId: "abc" });
    expect(web.contactId).not.toBe(wa.contactId);
  });

  it("creates one contact when two first messages arrive at once", async () => {
    const [a, b] = await Promise.all([
      findOrCreateConversation(db, { channel: "whatsapp", externalId: "8801711111111" }),
      findOrCreateConversation(db, { channel: "whatsapp", externalId: "8801711111111" }),
    ]);
    expect(a.contactId).toBe(b.contactId);
    expect(await db.select().from(contacts)).toHaveLength(1);
  });
});

describe("a WhatsApp customer with a phone number and a user id", () => {
  const phone = "8801700000000";
  const userId = "BD.1000000000000001";
  const identities = async () =>
    (await db.select().from(channelIdentities)).map((row) => [row.externalId, row.contactId]).sort();

  it("stores both ids on one contact", async () => {
    const conv = await findOrCreateConversation(db, { channel: "whatsapp", externalId: userId, otherIds: [phone] });
    expect(await identities()).toEqual([[userId, conv.contactId], [phone, conv.contactId]].sort());
  });

  it("finds the same conversation by the user id alone once the phone number disappears", async () => {
    const before = await findOrCreateConversation(db, { channel: "whatsapp", externalId: phone });
    await findOrCreateConversation(db, { channel: "whatsapp", externalId: userId, otherIds: [phone] });
    const after = await findOrCreateConversation(db, { channel: "whatsapp", externalId: userId });
    expect(after.id).toBe(before.id);
    expect(await db.select().from(contacts)).toHaveLength(1);
  });

  it("starts a contact for a customer known only by user id", async () => {
    const conv = await findOrCreateConversation(db, { channel: "whatsapp", externalId: userId });
    expect(await identities()).toEqual([[userId, conv.contactId]]);
  });

  it("moves an id that pointed at another contact onto the one found first", async () => {
    const byUserId = await findOrCreateConversation(db, { channel: "whatsapp", externalId: userId });
    await findOrCreateConversation(db, { channel: "whatsapp", externalId: phone });
    await findOrCreateConversation(db, { channel: "whatsapp", externalId: userId, otherIds: [phone] });
    expect(await identities()).toEqual([[userId, byUserId.contactId], [phone, byUserId.contactId]].sort());
  });

  it("finds the conversation by any of the ids", async () => {
    const conv = await findOrCreateConversation(db, { channel: "whatsapp", externalId: phone });
    expect((await findConversation(db, { channel: "whatsapp", externalId: [userId, phone] }))?.id).toBe(conv.id);
    expect(await findConversation(db, { channel: "whatsapp", externalId: [userId] })).toBeUndefined();
  });
});

describe("messages", () => {
  it("stores channel, direction, sender, body and payload", async () => {
    const conv = await findOrCreateConversation(db, { channel: "whatsapp", externalId: "x1" });
    const options = [{ id: "sundarbans:2026-11-05", label: "Thu 5 Nov" }];
    const stored = await appendMessage(db, {
      conversationId: conv.id,
      channel: "whatsapp",
      direction: "outbound",
      sentBy: "ai",
      body: "Pick a departure",
      payload: { kind: "choices", prompt: "Pick a departure", options },
    });
    expect(stored).toMatchObject({
      channel: "whatsapp",
      direction: "outbound",
      sentBy: "ai",
      body: "Pick a departure",
      payload: { kind: "choices", options },
    });
  });

  it("loads only the last 20 messages, oldest first", async () => {
    const conv = await findOrCreateConversation(db, { channel: "web", externalId: "long" });
    for (let i = 1; i <= 45; i++) {
      await appendMessage(db, {
        conversationId: conv.id,
        channel: "web",
        direction: i % 2 ? "inbound" : "outbound",
        sentBy: i % 2 ? "customer" : "ai",
        body: `message ${i}`,
      });
    }
    const window = await loadWindow(db, conv.id);
    expect(window).toHaveLength(20);
    expect(window[0]?.body).toBe("message 26");
    expect(window.at(-1)?.body).toBe("message 45");
  });
});

describe("state", () => {
  it("keeps an early quote after it falls out of the window", async () => {
    const conv = await findOrCreateConversation(db, { channel: "web", externalId: "s1" });
    await updateState(db, conv.id, { quote: quote(29_000, 1) });
    expect((await getConversation(db, conv.id))?.state.quote?.totalBdt).toBe(29_000);
  });

  it("a second quote replaces the first and leaves other keys alone", async () => {
    const conv = await findOrCreateConversation(db, { channel: "web", externalId: "s2" });
    await updateState(db, conv.id, { quote: quote(29_000, 1) });
    await updateState(db, conv.id, {
      booking: {
        id: 1,
        tourSlug: "sundarbans",
        tourName: "Sundarbans 3-day boat tour",
        departsOn: "2026-11-05",
        label: "Thu 5 Nov",
        travelers: 2,
        totalBdt: 29_000,
      },
    });
    await updateState(db, conv.id, { quote: quote(30_000, 2) });
    const [row] = await db.select().from(conversations).where(eq(conversations.id, conv.id));
    expect(row?.state.quote).toEqual(quote(30_000, 2));
    expect(row?.state.booking?.id).toBe(1);
  });
});
