import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { channelIdentities, conversations, linkCodes, messages } from "@/db/schema";
import { findConversation, findOrCreateConversation, getConversation, updateState } from "@/lib/conversations/store";
import { setupTestDb } from "../../test/int/db";
import { newConversation } from "../../test/int/fixtures";
import { createLinkCode, linkWhatsApp } from "./linking";

const db = setupTestDb();
const now = new Date("2026-10-25T08:00:00Z");
const minutes = (n: number) => new Date(now.getTime() + n * 60_000);

const quote = {
  tour: { slug: "sylhet-tea-gardens", name: "Sylhet tea gardens 2-day" },
  travelers: 2,
  pricePerPersonBdt: 8500,
  totalBdt: 17000,
} as never;

describe("linkWhatsApp", () => {
  it("moves a new number onto the web conversation, quote included", async () => {
    const web = await newConversation(db, "web");
    await updateState(db, web.id, { quote });
    const code = await createLinkCode(db, web.id, now);

    const result = await linkWhatsApp(db, { code, whatsappId: "8801700001234", displayName: "Rahim", now: minutes(5) });

    expect(result).toEqual({ linked: true, conversationId: web.id });
    const continued = await findConversation(db, { channel: "whatsapp", externalId: "8801700001234" });
    expect(continued?.id).toBe(web.id);
    expect(continued?.state.quote).toEqual(quote);
    const [used] = await db.select().from(linkCodes).where(eq(linkCodes.code, code));
    expect(used).toMatchObject({ usedAt: minutes(5), usedByIdentity: expect.any(Number) });
    const notes = await db.select().from(messages).where(eq(messages.conversationId, web.id));
    expect(notes.map((m) => [m.sentBy, m.channel, m.body])).toEqual([
      ["system", "whatsapp", "Customer continued from the website on WhatsApp."],
    ]);
  });

  it("does nothing with an expired code", async () => {
    const web = await newConversation(db, "web");
    const code = await createLinkCode(db, web.id, now);

    expect(await linkWhatsApp(db, { code, whatsappId: "8801700001234", now: minutes(20) })).toEqual({ linked: false });
    expect(await findConversation(db, { channel: "whatsapp", externalId: "8801700001234" })).toBeUndefined();
  });

  it("does nothing with a code that does not exist", async () => {
    expect(await linkWhatsApp(db, { code: "TR-ZZZZZZ", whatsappId: "8801700001234", now })).toEqual({ linked: false });
  });

  it("works once: a second number with the same code is not linked", async () => {
    const web = await newConversation(db, "web");
    const code = await createLinkCode(db, web.id, now);

    expect(await linkWhatsApp(db, { code, whatsappId: "8801700001111", now: minutes(1) })).toMatchObject({ linked: true });
    expect(await linkWhatsApp(db, { code, whatsappId: "8801700002222", now: minutes(2) })).toEqual({ linked: false });
    expect(await findConversation(db, { channel: "whatsapp", externalId: "8801700002222" })).toBeUndefined();
  });

  it("still counts the code for the number that used it, so a retried message continues", async () => {
    const web = await newConversation(db, "web");
    const code = await createLinkCode(db, web.id, now);

    await linkWhatsApp(db, { code, whatsappId: "8801700006666", now: minutes(1) });
    expect(await linkWhatsApp(db, { code, whatsappId: "8801700006666", now: minutes(2) })).toEqual({ linked: true, conversationId: web.id });
    const notes = await db.select().from(messages).where(eq(messages.conversationId, web.id));
    expect(notes).toHaveLength(1);
  });

  it("links once when two messages use the code at the same time", async () => {
    const web = await newConversation(db, "web");
    const code = await createLinkCode(db, web.id, now);

    const results = await Promise.all([
      linkWhatsApp(db, { code, whatsappId: "8801700003333", now: minutes(1) }),
      linkWhatsApp(db, { code, whatsappId: "8801700004444", now: minutes(1) }),
    ]);

    expect(results.filter((r) => r.linked)).toHaveLength(1);
    const identities = await db.select().from(channelIdentities).where(eq(channelIdentities.contactId, web.contactId));
    expect(identities.filter((i) => i.channel === "whatsapp")).toHaveLength(1);
  });

  it("closes and keeps a returning number's older conversation", async () => {
    const older = await findOrCreateConversation(db, { channel: "whatsapp", externalId: "8801700005555" });
    const web = await newConversation(db, "web");
    const code = await createLinkCode(db, web.id, now);

    await linkWhatsApp(db, { code, whatsappId: "8801700005555", now: minutes(1) });

    expect((await getConversation(db, older.id))?.closedAt).toEqual(minutes(1));
    expect((await findConversation(db, { channel: "whatsapp", externalId: "8801700005555" }))?.id).toBe(web.id);
    // The next message from the number lands on the web conversation, not a new one.
    expect((await findOrCreateConversation(db, { channel: "whatsapp", externalId: "8801700005555" })).id).toBe(web.id);
    expect(await db.select().from(conversations).where(eq(conversations.id, older.id))).toHaveLength(1);
  });
});
