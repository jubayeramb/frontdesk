import { eq, sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import type { Db } from "@/db/client";
import { bookings, channelIdentities, contacts, conversations, linkCodes, messages, tours, turns, webhookEvents } from "@/db/schema";
import { seed } from "@/db/seed-data";
import { appendMessage } from "@/lib/conversations/store";
import { createLinkCode } from "@/lib/linking";
import { setupTestDb } from "../../test/int/db";
import { newConversation } from "../../test/int/fixtures";
import { deleteExpired, handleRetention } from "./retention";

const db = setupTestDb();
const now = new Date("2026-11-20T03:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60_000);
const SECRET = "test-cron-secret-0123";

// A conversation with a message, a booking, a link code and a turn, all from
// `days` ago, made by a contact who also started then.
async function conversationFrom(db: Db, days: number) {
  const conversation = await newConversation(db, "whatsapp");
  const message = await appendMessage(db, { conversationId: conversation.id, channel: "whatsapp", direction: "inbound", sentBy: "customer", body: "hi" });
  const [tour] = await db.select().from(tours).limit(1);
  await db.insert(bookings).values({ conversationId: conversation.id, tourId: tour!.id, departsOn: "2026-12-01", travelers: 2, quote: {} as never });
  await createLinkCode(db, conversation.id, daysAgo(days));
  await db.insert(turns).values({ contactId: conversation.contactId, conversationId: conversation.id, model: "primary", createdAt: daysAgo(days) });
  const at = daysAgo(days);
  await db.update(messages).set({ createdAt: at }).where(eq(messages.id, message.id));
  await db.update(conversations).set({ createdAt: at, updatedAt: at }).where(eq(conversations.id, conversation.id));
  await db.update(contacts).set({ createdAt: at }).where(eq(contacts.id, conversation.contactId));
  return conversation;
}

type Table = typeof messages | typeof bookings | typeof linkCodes | typeof turns | typeof contacts | typeof channelIdentities | typeof conversations | typeof webhookEvents;
const count = async (table: Table) =>
  (await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(table))[0]!.n;

describe("deleteExpired", () => {
  it("deletes a conversation whose last message is 8 days old, with everything that hangs off it", async () => {
    await seed(db);
    await conversationFrom(db, 8);

    expect(await deleteExpired(db, now)).toEqual({ conversations: 1, contacts: 1, webhookEvents: 0 });
    for (const table of [conversations, messages, bookings, linkCodes, turns, contacts, channelIdentities]) {
      expect(await count(table)).toBe(0);
    }
  });

  it("keeps a conversation that started 10 days ago but had a message yesterday", async () => {
    await seed(db);
    const conversation = await conversationFrom(db, 10);
    await db.insert(messages).values({ conversationId: conversation.id, channel: "whatsapp", direction: "inbound", sentBy: "customer", body: "still there?", createdAt: daysAgo(1) });

    expect(await deleteExpired(db, now)).toEqual({ conversations: 0, contacts: 0, webhookEvents: 0 });
    expect(await count(conversations)).toBe(1);
    expect(await count(messages)).toBe(2);
    expect(await count(bookings)).toBe(1);
  });

  it("keeps a contact who still has a recent conversation when an old one goes", async () => {
    await seed(db);
    const old = await conversationFrom(db, 9);
    await db.update(conversations).set({ closedAt: daysAgo(9) }).where(eq(conversations.id, old.id));
    await db.insert(conversations).values({ contactId: old.contactId, createdAt: daysAgo(1), updatedAt: daysAgo(1) });

    expect(await deleteExpired(db, now)).toEqual({ conversations: 1, contacts: 0, webhookEvents: 0 });
    expect(await count(contacts)).toBe(1);
    expect(await count(channelIdentities)).toBe(1);
  });

  it("prunes webhook events that finished or failed more than 7 days ago, and keeps the rest", async () => {
    const event = (key: string, status: "pending" | "done" | "failed", days: number) => ({
      dedupeKey: key,
      partitionKey: "8801700000000",
      eventType: "whatsapp.message.received",
      payload: {},
      status,
      createdAt: daysAgo(days),
      updatedAt: daysAgo(days),
    });
    await db.insert(webhookEvents).values([
      event("old-done", "done", 8),
      event("old-failed", "failed", 8),
      event("old-pending", "pending", 8),
      event("recent-done", "done", 6),
    ]);

    expect(await deleteExpired(db, now)).toMatchObject({ webhookEvents: 2 });
    expect((await db.select({ key: webhookEvents.dedupeKey }).from(webhookEvents)).map((e) => e.key).sort()).toEqual(["old-pending", "recent-done"]);
  });
});

describe("handleRetention", () => {
  const request = (authorization?: string) =>
    new Request("http://localhost/api/cron/retention", { headers: authorization ? { authorization } : {} });

  it("refuses a request without the cron secret, or with the wrong one, and deletes nothing", async () => {
    await seed(db);
    await conversationFrom(db, 8);

    for (const header of [undefined, "Bearer wrong", SECRET, `Bearer ${SECRET}x`]) {
      expect((await handleRetention(request(header), { db, secret: SECRET, now: () => now })).status).toBe(401);
    }
    expect(await count(conversations)).toBe(1);
  });

  it("runs for the scheduler and logs counts only", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await seed(db);
    await conversationFrom(db, 8);

    const response = await handleRetention(request(`Bearer ${SECRET}`), { db, secret: SECRET, now: () => now });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ conversations: 1, contacts: 1, webhookEvents: 0 });
    expect(info).toHaveBeenCalledWith("retention deleted 1 conversations, 1 contacts, 0 webhook events");
    info.mockRestore();
  });
});
