import { asc, eq } from "drizzle-orm";
import type { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";

import { conversations, messages, webhookEvents } from "@/db/schema";
import { seed } from "@/db/seed-data";
import { createWhatsAppAdapter } from "@/lib/channels/whatsapp/adapter";
import { setupTestDb } from "../../../test/int/db";
import { fakeKapso } from "../../../test/support/fake-kapso";
import { FIXTURE_SECRET, fixtureRequest, kapsoFixture } from "../../../test/support/kapso-fixtures";
import { scriptedModel, type ScriptStep } from "../../../test/support/scripted-model";
import { createLinkCode } from "@/lib/linking";
import { transition } from "@/lib/ownership";
import { findOrCreateConversation, updateState } from "@/lib/conversations/store";
import { drain } from "./events";
import { createKapsoAcknowledger, createKapsoHandler } from "./kapso-handler";
import { receiveKapsoWebhook } from "./receive";

const db = setupTestDb();
const CUSTOMER = "8801700000000";

function setup(script: ScriptStep[], opts: { echoWaitMs?: number } = {}) {
  const kapso = fakeKapso();
  const model = scriptedModel(script);
  const adapter = createWhatsAppAdapter({ apiKey: "k", phoneNumberId: "1382322134966757", fetch: kapso.fetch });
  const handle = createKapsoHandler({ db, adapter, models: [{ id: "primary", model }], now: () => new Date(), echoWaitMs: opts.echoWaitMs ?? 50 });
  // Runs the after-response work straight away, as a quiet production would.
  const post = async (request: Request) => {
    let work: (() => Promise<void>) | undefined;
    const response = await receiveKapsoWebhook(request, {
      db,
      secret: FIXTURE_SECRET,
      phoneNumberId: "1382322134966757",
      handle,
      acknowledge: createKapsoAcknowledger({ db, adapter }),
      schedule: (w) => void (work = w),
    });
    await work?.();
    return response;
  };
  return { kapso, model, handle, post };
}

const text = (id: string, body: string) =>
  fixtureRequest("message-received-text", (b) => {
    const message = b.message as { id: string; text: { body: string } };
    message.id = id;
    message.text.body = body;
  });

const stored = () => db.select().from(messages).orderBy(asc(messages.id));
const prompt = (model: MockLanguageModelV4) => JSON.stringify(model.doGenerateCalls.at(-1)?.prompt);

describe("whatsapp.message.received", () => {
  it("answers a customer message and records both sides", async () => {
    const { kapso, post } = setup([{ text: "Hi! Which tour are you thinking of?" }]);

    expect((await post(fixtureRequest("message-received-text"))).status).toBe(200);

    expect(kapso.sends).toEqual([expect.objectContaining({ to: CUSTOMER, type: "text", text: expect.objectContaining({ body: "Hi! Which tour are you thinking of?" }) })]);
    const [inbound, outbound] = await stored();
    expect(inbound).toMatchObject({ channel: "whatsapp", direction: "inbound", sentBy: "customer", body: "Hello", externalId: expect.stringMatching(/^wamid\./) });
    expect(outbound).toMatchObject({ channel: "whatsapp", direction: "outbound", sentBy: "ai", externalId: "wamid.fake-1", deliveryStatus: "sent" });

    const [conversation] = await db.select().from(conversations);
    expect(conversation).toMatchObject({ kapsoConversationId: "587da297-2527-4b23-aff8-fe5735205deb" });
    expect(conversation!.waLastInboundAt).toEqual(new Date(1792819372 * 1000));
  });

  it("sends departures as a list and reads a tapped row back as that departure", async () => {
    await seed(db);
    const { kapso, model, post } = setup([
      { tools: [{ name: "listDepartures", input: { tourSlug: "sundarbans" } }] },
      { text: "Here are the next departures." },
      { text: "Booking that one for you." },
    ]);

    await post(text("wamid.q1", "When does the Sundarbans tour leave?"));

    expect(kapso.sends.map((s) => (s.interactive as { type?: string } | undefined)?.type ?? s.type)).toEqual(["text", "list"]);
    const rows = (kapso.sends[1]!.interactive as { action: { sections: { rows: { id: string; title: string }[] }[] } }).action.sections[0]!.rows;
    const picked = rows[1]!;

    await post(
      fixtureRequest("message-received-list-reply", (b) => {
        const message = b.message as { id: string; interactive: { list_reply: { id: string; title: string } } };
        message.id = "wamid.tap1";
        message.interactive.list_reply = { id: picked.id, title: picked.title };
      }),
    );

    expect(prompt(model)).toContain(`(picked option id: ${picked.id})`);
    const tap = (await stored()).find((m) => m.externalId === "wamid.tap1");
    expect(tap).toMatchObject({ body: picked.title, payload: { choiceId: picked.id } });
  });

  it("replies once when Kapso delivers the same message twice", async () => {
    const { kapso, post } = setup([{ text: "Hello there." }]);
    await post(fixtureRequest("message-received-text"));
    await post(fixtureRequest("message-received-text"));
    expect(kapso.sends).toHaveLength(1);
    expect(kapso.receipts).toHaveLength(1);
  });

  it("does not answer again when an event is retried after its turn ran", async () => {
    const { kapso, handle, post } = setup([{ text: "Hello there." }]);
    await post(fixtureRequest("message-received-text"));
    await db.update(webhookEvents).set({ status: "pending" });

    await drain(db, CUSTOMER, handle);

    expect(kapso.sends).toHaveLength(1);
  });

  it("answers quick messages one at a time, each turn seeing the one before", async () => {
    const { kapso, model, post } = setup([{ text: "Reply one." }, { text: "Reply two." }, { text: "Reply three." }]);

    await post(fixtureRequest("message-received-batch"));

    expect(kapso.sends.map((s) => (s.text as { body: string }).body)).toEqual(["Reply one.", "Reply two.", "Reply three."]);
    const second = JSON.stringify(model.doGenerateCalls[1]!.prompt);
    expect(second.indexOf('"X"')).toBeLessThan(second.indexOf("Reply one."));
    expect(second).toContain('"Y"');
    expect(second).not.toContain('"Z"');
  });

  it("shows the typing indicator on the customer's message before the reply", async () => {
    const { kapso, post } = setup([{ text: "Hi! Which tour are you thinking of?" }]);
    await post(text("wamid.typing1", "how much is the Sundarbans tour for 2?"));

    expect(kapso.log.map((body) => (body.status === "read" ? "receipt" : "send"))).toEqual(["receipt", "send"]);
    expect(kapso.receipts[0]).toMatchObject({ status: "read", message_id: "wamid.typing1", typing_indicator: { type: "text" } });
  });

  it("still replies when Kapso rejects the typing indicator", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { kapso, post } = setup([{ text: "Hello there." }]);
    kapso.failReceipts(500, { error: { message: "Service unavailable", type: "OAuthException", code: 2 } });

    await post(fixtureRequest("message-received-text"));

    expect(kapso.sends).toHaveLength(1);
    expect((await db.select().from(webhookEvents))[0]).toMatchObject({ status: "done" });
    warn.mockRestore();
  });

  it("does not show the typing indicator again when a retried event skips its turn", async () => {
    const { kapso, handle, post } = setup([{ text: "Hello there." }]);
    await post(fixtureRequest("message-received-text"));
    await db.update(webhookEvents).set({ status: "pending" });
    await drain(db, CUSTOMER, handle);
    expect(kapso.receipts).toHaveLength(1);
  });

  it("stays quiet while a person owns the conversation, marks the message read and keeps it for them", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { kapso, model, post } = setup([{ text: "Hello there." }]);
    await post(text("wamid.first", "hi"));
    const [conversation] = await db.select().from(conversations);
    await transition(db, { conversationId: conversation!.id, event: "customer_requested" });

    await post(text("wamid.during", "thanks, also can you do Friday?"));

    expect(model.doGenerateCalls).toHaveLength(1);
    expect(kapso.sends).toHaveLength(1);
    expect(kapso.receipts.map((r) => [r.message_id, "typing_indicator" in r])).toEqual([
      ["wamid.first", true],
      ["wamid.during", false],
    ]);
    expect((await stored()).find((m) => m.externalId === "wamid.during")).toMatchObject({ sentBy: "customer", body: "thanks, also can you do Friday?" });
  });

  it("stores an image without running a turn", async () => {
    const { kapso, model, post } = setup([{ text: "unused" }]);
    await post(fixtureRequest("message-received-image"));
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(kapso.sends).toHaveLength(0);
    expect(kapso.receipts).toHaveLength(0);
    expect((await db.select().from(webhookEvents))[0]).toMatchObject({ status: "done" });
  });
});

describe("whatsapp.message.sent", () => {
  const inboxReplyId = () => (JSON.parse(kapsoFixture("message-sent-inbox-reply").body) as { message: { id: string } }).message.id;

  it("takes a reply from the inbox as a person taking over, and the agent stays quiet", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { kapso, model, post } = setup([{ text: "Hi! Which tour are you thinking of?" }]);
    await post(fixtureRequest("message-received-text"));

    await post(fixtureRequest("message-sent-inbox-reply", undefined, { event: "whatsapp.message.sent" }));

    const reply = (await stored()).find((m) => m.externalId === inboxReplyId());
    expect(reply).toMatchObject({ sentBy: "human", direction: "outbound", body: "Hi, this is a person replying from Kapso dashboard." });
    const [conversation] = await db.select().from(conversations);
    expect(conversation!.owner).toBe("human");
    // The takeover note sits before the reply that caused it, so timelines read in order.
    expect((await stored()).slice(-2).map((m) => m.sentBy)).toEqual(["system", "human"]);

    await post(text("wamid.after", "thanks!"));
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(kapso.sends).toHaveLength(1);
  });

  it("recognizes our own send whose echo arrives before its id is stored", async () => {
    const { post } = setup([{ text: "unused" }], { echoWaitMs: 300 });
    await post(fixtureRequest("message-received-text"));
    const [conversation] = await db.select().from(conversations);
    // An agent reply mid-send: stored, marked pending, no WhatsApp id yet.
    const [ours] = await db
      .insert(messages)
      .values({ conversationId: conversation!.id, channel: "whatsapp", direction: "outbound", sentBy: "ai", body: "Here are our tours.", deliveryStatus: "pending", clientNonce: "n-1" })
      .returning();
    // The send result lands while the echo waits.
    // Drizzle queries run when awaited, hence the then().
    setTimeout(() => void db.update(messages).set({ externalId: inboxReplyId(), deliveryStatus: "sent" }).where(eq(messages.id, ours!.id)).then(), 100);

    await post(fixtureRequest("message-sent-inbox-reply", undefined, { event: "whatsapp.message.sent" }));

    expect((await stored()).filter((m) => m.sentBy === "human")).toEqual([]);
    expect((await db.select().from(conversations))[0]!.owner).toBe("ai");
  });

  it("takes an unknown message as a person's after three checks, even with a send in flight", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { post } = setup([{ text: "unused" }]);
    await post(fixtureRequest("message-received-text"));
    const [conversation] = await db.select().from(conversations);
    await db.insert(messages).values({ conversationId: conversation!.id, channel: "whatsapp", direction: "outbound", sentBy: "ai", body: "stuck", deliveryStatus: "pending" });

    await post(fixtureRequest("message-sent-inbox-reply", undefined, { event: "whatsapp.message.sent" }));

    const [event] = await db.select().from(webhookEvents).where(eq(webhookEvents.eventType, "whatsapp.message.sent"));
    expect(event).toMatchObject({ status: "done", attempts: 4 });
    expect((await db.select().from(conversations))[0]!.owner).toBe("human");
  });
});

describe("whatsapp.conversation.ended", () => {
  it("gives a person-owned conversation back to the agent, which answers the next message", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { kapso, post } = setup([{ text: "Hi again." }, { text: "Your booking is on Fri 30 Oct." }]);
    await post(fixtureRequest("message-received-text"));
    const [conversation] = await db.select().from(conversations);
    await transition(db, { conversationId: conversation!.id, event: "human_replied" });

    await post(fixtureRequest("conversation-ended", undefined, { event: "whatsapp.conversation.ended" }));
    expect((await db.select().from(conversations))[0]!.owner).toBe("ai");

    await post(text("wamid.back", "what time is my booking?"));
    expect(kapso.sends.map((s) => (s.text as { body: string }).body)).toEqual(["Hi again.", "Your booking is on Fri 30 Oct."]);
  });
});

describe("whatsapp.message.failed", () => {
  it("marks the message we sent as failed with the reported error", async () => {
    const { post } = setup([{ text: "Hello there." }]);
    await post(fixtureRequest("message-received-text"));

    // Shape from Kapso's event reference; no failure could be captured live.
    await post(
      fixtureRequest(
        "message-delivered",
        (b) => {
          b.message = {
            id: "wamid.fake-1",
            type: "text",
            kapso: {
              direction: "outbound",
              status: "failed",
              statuses: [
                { id: "wamid.fake-1", status: "sent" },
                { id: "wamid.fake-1", status: "failed", errors: [{ code: 131047, title: "Re-engagement message" }] },
              ],
            },
          };
        },
        { event: "whatsapp.message.failed" },
      ),
    );

    const [sent] = await db.select().from(messages).where(eq(messages.externalId, "wamid.fake-1"));
    expect(sent).toMatchObject({ deliveryStatus: "failed", deliveryError: "131047: Re-engagement message" });
  });
});

describe("link codes", () => {
  const quote = {
    tour: { slug: "sylhet-tea-gardens", name: "Sylhet tea gardens 2-day" },
    travelers: 2,
    pricePerPersonBdt: 8500,
    totalBdt: 17000,
  } as never;

  it("continues the web conversation on WhatsApp, and the turn sees the web quote but not the code", async () => {
    const web = await findOrCreateConversation(db, { channel: "web", externalId: "visitor-link" });
    await updateState(db, web.id, { quote });
    const code = await createLinkCode(db, web.id, new Date());
    const { kapso, model, post } = setup([{ text: "Welcome back! Your Sylhet quote is ready." }]);

    await post(text("wamid.code1", `Hi! My code is ${code}`));

    const sent = prompt(model);
    expect(sent).toContain("Latest quote: Sylhet tea gardens 2-day");
    expect(sent).toContain("continuing my website chat here on WhatsApp");
    expect(sent).not.toContain(code);
    expect(kapso.sends).toHaveLength(1);
    const rows = (await stored()).filter((m) => m.conversationId === web.id);
    expect(rows.map((m) => [m.sentBy, m.channel])).toEqual([
      ["system", "whatsapp"],
      ["customer", "whatsapp"],
      ["ai", "whatsapp"],
    ]);
  });

  it("tells the agent an expired code did not work, and links nothing", async () => {
    const web = await findOrCreateConversation(db, { channel: "web", externalId: "visitor-old" });
    const code = await createLinkCode(db, web.id, new Date(Date.now() - 20 * 60_000));
    const { model, post } = setup([{ text: "That code has expired, but I can help from here." }]);

    await post(text("wamid.code2", `Hi! My code is ${code}`));

    expect(prompt(model)).toContain("expired or was already used");
    expect((await stored()).filter((m) => m.conversationId === web.id)).toEqual([]);
  });
});
