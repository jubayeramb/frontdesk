import { asc, eq } from "drizzle-orm";
import type { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";

import { conversations, messages, webhookEvents } from "@/db/schema";
import { seed } from "@/db/seed-data";
import { createWhatsAppAdapter } from "@/lib/channels/whatsapp/adapter";
import { setupTestDb } from "../../../test/int/db";
import { fakeKapso } from "../../../test/support/fake-kapso";
import { FIXTURE_SECRET, fixtureRequest } from "../../../test/support/kapso-fixtures";
import { scriptedModel, type ScriptStep } from "../../../test/support/scripted-model";
import { drain } from "./events";
import { createKapsoAcknowledger, createKapsoHandler } from "./kapso-handler";
import { receiveKapsoWebhook } from "./receive";

const db = setupTestDb();
const CUSTOMER = "8801700000000";
// Monday 2 November 2026, 10:00 in Dhaka.
const now = new Date("2026-11-02T10:00:00+06:00");

function setup(script: ScriptStep[]) {
  const kapso = fakeKapso();
  const model = scriptedModel(script);
  const adapter = createWhatsAppAdapter({ apiKey: "k", phoneNumberId: "1382322134966757", fetch: kapso.fetch });
  const handle = createKapsoHandler({ db, adapter, models: [{ id: "primary", model }], now: () => now });
  // Runs the after-response work straight away, as a quiet production would.
  const post = async (request: Request) => {
    let work: (() => Promise<void>) | undefined;
    const response = await receiveKapsoWebhook(request, {
      db,
      secret: FIXTURE_SECRET,
      phoneNumberId: "1382322134966757",
      handle,
      acknowledge: createKapsoAcknowledger({ adapter }),
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

  it("stores an image without running a turn", async () => {
    const { kapso, model, post } = setup([{ text: "unused" }]);
    await post(fixtureRequest("message-received-image"));
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(kapso.sends).toHaveLength(0);
    expect(kapso.receipts).toHaveLength(0);
    expect((await db.select().from(webhookEvents))[0]).toMatchObject({ status: "done" });
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
