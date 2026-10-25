import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { linkCodes, turns, type Channel } from "@/db/schema";
import { seed } from "@/db/seed-data";
import { getConversation, loadWindow } from "@/lib/conversations/store";
import { findCode } from "@/lib/linking";
import { setupTestDb } from "../../../test/int/db";
import { newConversation } from "../../../test/int/fixtures";
import { scriptedModel, type ScriptStep } from "../../../test/support/scripted-model";
import type { NamedModel } from "./model";
import { transition } from "@/lib/ownership";
import { BUSY_REPLY, runTurn, type Inbound } from "./run-turn";

const db = setupTestDb();
// Monday 2 November 2026, 10:00 in Dhaka.
const now = new Date("2026-11-02T10:00:00+06:00");

afterEach(() => vi.restoreAllMocks());

function only(model: MockLanguageModelV4): NamedModel[] {
  return [{ id: "primary", model }];
}

async function turn(script: ScriptStep[], inbound: Inbound, opts: { channel?: Channel; conversationId?: string } = {}) {
  const channel = opts.channel ?? "web";
  const conversationId = opts.conversationId ?? (await newConversation(db, channel)).id;
  const model = scriptedModel(script);
  const { replies } = await runTurn({ db, conversationId, channel, inbound, now, models: only(model) });
  return { replies, model, conversationId };
}

const lastPrompt = (model: MockLanguageModelV4) => JSON.stringify(model.doGenerateCalls.at(-1)?.prompt);

describe("prices", () => {
  it("finds the tour from the customer's words and shows prices in taka", async () => {
    await seed(db);
    const { replies } = await turn(
      [
        { tools: [{ name: "getQuote", input: { tourSlug: "Sylhet tour", travelers: 2 } }] },
        { text: "The Sylhet tea gardens tour is ₹17,000 in total (₹8,500 per person)." },
      ],
      { text: "How much is the Sylhet tour for 2?" },
    );
    expect(replies).toEqual([{ kind: "text", text: "The Sylhet tea gardens tour is ৳17,000 in total (৳8,500 per person)." }]);
  });

  it("quotes through the tool and the reply holds the tool's total", async () => {
    await seed(db);
    const { replies, model, conversationId } = await turn(
      [
        { tools: [{ name: "getQuote", input: { tourSlug: "sundarbans", travelers: 4 } }] },
        { text: "The Sundarbans tour for 4 people is ৳58,000 in total (৳14,500 each)." },
      ],
      { text: "how much is the Sundarbans tour for 4 people?" },
    );
    expect(replies).toEqual([
      { kind: "text", text: "The Sundarbans tour for 4 people is ৳58,000 in total (৳14,500 each)." },
    ]);
    // The model saw the tool's numbers, and the quote was stored for later turns.
    expect(lastPrompt(model)).toContain("৳58,000");
    expect((await getConversation(db, conversationId))?.state.quote?.totalBdt).toBe(58_000);
  });

  it("replaces a reply that states an amount no tool returned", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await seed(db);
    const { replies } = await turn(
      [
        { tools: [{ name: "getQuote", input: { tourSlug: "sundarbans", travelers: 4 } }] },
        { text: "That will be ৳50,000." },
      ],
      { text: "price for 4 on the Sundarbans tour?" },
    );
    expect(replies).toEqual([
      { kind: "text", text: "Sundarbans 3-day boat tour for 4 travelers: ৳14,500 per person, ৳58,000 total." },
    ]);
  });

  it("asks for details instead of guessing when the tour or group size is missing", async () => {
    await seed(db);
    const { replies, model } = await turn(
      [{ text: "Happy to help! Which tour, and how many people are travelling?" }],
      { text: "how much is a tour?" },
    );
    expect(replies).toEqual([
      { kind: "text", text: "Happy to help! Which tour, and how many people are travelling?" },
    ]);
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it("passes a tool's validation message on instead of an error", async () => {
    await seed(db);
    const { replies, model } = await turn(
      [
        { tools: [{ name: "getQuote", input: { tourSlug: "sundarbans", travelers: 15 } }] },
        { text: "We can book 1 to 10 travelers at a time. How many of you are going?" },
      ],
      { text: "Sundarbans for 15 people" },
    );
    expect(lastPrompt(model)).toContain("Bookings take 1 to 10 travelers.");
    expect(replies[0]).toMatchObject({ kind: "text", text: expect.stringContaining("1 to 10 travelers") });
  });
});

describe("choices", () => {
  it("offers exactly the departures the tool returned, after the model's line", async () => {
    await seed(db);
    const { replies } = await turn(
      [
        { tools: [{ name: "listDepartures", input: { tourSlug: "sundarbans" } }] },
        { text: "Here are the next departures:" },
      ],
      { text: "when does the Sundarbans tour leave?" },
    );
    expect(replies).toEqual([
      { kind: "text", text: "Here are the next departures:" },
      {
        kind: "choices",
        prompt: "Departures for Sundarbans 3-day boat tour",
        label: "View dates",
        options: [
          { id: "sundarbans:2026-11-05", label: "Thu 5 Nov" },
          { id: "sundarbans:2026-11-08", label: "Sun 8 Nov" },
          { id: "sundarbans:2026-11-12", label: "Thu 12 Nov" },
          { id: "sundarbans:2026-11-15", label: "Sun 15 Nov" },
        ],
      },
    ]);
  });

  it("drops tour options once the turn has quoted the tour the customer named", async () => {
    await seed(db);
    // Seen on a real phone: the model looks the tour up, then quotes it.
    const { replies } = await turn(
      [
        { tools: [{ name: "listTours", input: {} }] },
        { tools: [{ name: "getQuote", input: { tourSlug: "sundarbans", travelers: 2 } }] },
        { text: "The Sundarbans 3-day boat tour for 2 people is ৳29,000 in total." },
      ],
      { text: "How much Sundarban tour cost for 2 people?" },
    );
    expect(replies).toEqual([{ kind: "text", text: "The Sundarbans 3-day boat tour for 2 people is ৳29,000 in total." }]);
  });

  it("drops departure options once the turn has booked one", async () => {
    await seed(db);
    const { conversationId } = await turn(
      [{ tools: [{ name: "getQuote", input: { tourSlug: "sundarbans", travelers: 2 } }] }, { text: "৳29,000 for 2." }],
      { text: "Sundarbans for 2" },
    );
    const { replies } = await turn(
      [
        { tools: [{ name: "listDepartures", input: { tourSlug: "sundarbans" } }] },
        { tools: [{ name: "bookDeparture", input: { departureId: "sundarbans:2026-11-05" } }] },
        { text: "Booked: Thu 5 Nov, reference TR-00001." },
      ],
      { text: "Book Thursday 5 November" },
      { conversationId },
    );
    expect(replies.map((r) => r.kind)).toEqual(["text"]);
  });

  it("sends only the model's first message when it keeps writing", async () => {
    await seed(db);
    const { replies, conversationId } = await turn(
      [
        { tools: [{ name: "listDepartures", input: { tourSlug: "sundarbans" } }] },
        { text: "Pick a departure below.Let me know which date you'd like.Whenever you're ready, tell me." },
      ],
      { text: "when does it leave?" },
    );
    expect(replies[0]).toEqual({ kind: "text", text: "Pick a departure below." });
    expect((await loadWindow(db, conversationId)).map((m) => m.body)).toContain("Pick a departure below.");
  });

  it("drops the departures the model also listed in its text", async () => {
    await seed(db);
    const { replies } = await turn(
      [
        { tools: [{ name: "listDepartures", input: { tourSlug: "sylhet" } }] },
        { text: "These are the next departures for the Sylhet tour:\n- Fri 6 Nov\n- Fri 13 Nov" },
      ],
      { text: "when does the sylhet tour leave?" },
    );
    expect(replies[0]).toEqual({ kind: "text", text: "These are the next departures for the Sylhet tour." });
    expect(replies[1]).toMatchObject({ kind: "choices", options: expect.arrayContaining([{ id: "sylhet:2026-11-06", label: "Fri 6 Nov" }]) });
  });

  it("offers the quoted tour's departures when the model writes dates without listing them", async () => {
    await seed(db);
    // Seen on a real phone: the model copied dates from its own earlier reply.
    const { replies } = await turn(
      [
        { tools: [{ name: "getQuote", input: { tourSlug: "bandarban", travelers: 2 } }] },
        { text: "The Bandarban hills 3-day tour is ৳24,000 for 2 travelers. Which departure (28 Oct, 31 Oct, 4 Nov, 7 Nov) would you like to book?" },
      ],
      { text: "We're 2 people and want to book the Bandarban tour" },
    );
    expect(replies[0]).toEqual({
      kind: "text",
      text: "The Bandarban hills 3-day tour is ৳24,000 for 2 travelers. Which departure would you like to book?",
    });
    expect(replies[1]).toMatchObject({
      kind: "choices",
      label: "View dates",
      options: expect.arrayContaining([{ id: "bandarban:2026-11-07", label: "Sat 7 Nov" }]),
    });
  });

  it("offers departures when the model asks which one without naming any", async () => {
    await seed(db);
    const { replies } = await turn(
      [
        { tools: [{ name: "getQuote", input: { tourSlug: "bandarban", travelers: 2 } }] },
        { text: "The Bandarban hills 3-day tour is ৳24,000 for 2 travelers. Which departure would you like to book?" },
      ],
      { text: "We're 2 people and want to book the Bandarban tour" },
    );
    expect(replies[1]).toMatchObject({ kind: "choices", label: "View dates" });
  });

  it("does not offer departures for dates in a booking confirmation, or without a quote", async () => {
    await seed(db);
    const booked = await turn(
      [
        { tools: [{ name: "getQuote", input: { tourSlug: "sundarbans", travelers: 2 } }] },
        { tools: [{ name: "bookDeparture", input: { departureId: "sundarbans:2026-11-08" } }] },
        { text: "Booked for Sun 8 Nov, ৳29,000 in total." },
      ],
      { text: "2 of us, book the Sundarbans on Sunday 8 Nov" },
    );
    expect(booked.replies).toEqual([{ kind: "text", text: "Booked for Sun 8 Nov, ৳29,000 in total." }]);

    const unquoted = await turn([{ text: "Our tours leave from 28 Oct onwards." }], { text: "when do tours start?" });
    expect(unquoted.replies).toEqual([{ kind: "text", text: "Our tours leave from 28 Oct onwards." }]);
  });

  it("hands a tapped option's id to the model and books it", async () => {
    await seed(db);
    const first = await turn(
      [
        { tools: [{ name: "getQuote", input: { tourSlug: "sundarbans", travelers: 2 } }] },
        { tools: [{ name: "listDepartures", input: { tourSlug: "sundarbans" } }] },
        { text: "That's ৳29,000 for two. Pick a departure:" },
      ],
      { text: "Sundarbans for 2, please" },
    );
    const second = await turn(
      [
        { tools: [{ name: "bookDeparture", input: { departureId: "sundarbans:2026-11-08" } }] },
        { text: "You're booked on Sun 8 Nov for 2 travelers, ৳29,000 total." },
      ],
      { text: "Sun 8 Nov", choiceId: "sundarbans:2026-11-08" },
      { conversationId: first.conversationId },
    );
    // The model saw both the options it offered and the id that was picked.
    const prompt = lastPrompt(second.model);
    expect(prompt).toContain("Sun 8 Nov (id: sundarbans:2026-11-08)");
    expect(prompt).toContain("(picked option id: sundarbans:2026-11-08)");
    expect(second.replies).toEqual([
      { kind: "text", text: "You're booked on Sun 8 Nov for 2 travelers, ৳29,000 total." },
    ]);
    expect((await getConversation(db, first.conversationId))?.state.booking).toMatchObject({
      departsOn: "2026-11-08",
      totalBdt: 29_000,
    });
  });

  it("offers the current departures when the picked one is no longer available", async () => {
    await seed(db);
    const first = await turn(
      [
        { tools: [{ name: "getQuote", input: { tourSlug: "sundarbans", travelers: 2 } }] },
        { text: "That's ৳29,000 for two." },
      ],
      { text: "Sundarbans for 2" },
    );
    const { replies } = await turn(
      [
        { tools: [{ name: "bookDeparture", input: { departureId: "sundarbans:2026-11-02" } }] },
        { text: "That departure has closed, but these are open:" },
      ],
      { text: "book today's one" },
      { conversationId: first.conversationId },
    );
    expect(replies[1]).toMatchObject({
      kind: "choices",
      options: expect.arrayContaining([{ id: "sundarbans:2026-11-05", label: "Thu 5 Nov" }]),
    });
  });
});

describe("scope", () => {
  it("declines an off-topic request in a short text reply with no tools", async () => {
    await seed(db);
    const { replies, model } = await turn(
      [{ text: "Sorry, I can only help with Triplone Tours' tours, quotes and bookings." }],
      { text: "write me a poem about the sea" },
    );
    expect(replies).toEqual([
      { kind: "text", text: "Sorry, I can only help with Triplone Tours' tours, quotes and bookings." },
    ]);
    expect(model.doGenerateCalls).toHaveLength(1);
    // The scope rule was in the system prompt the model received.
    expect(lastPrompt(model)).toContain("Only help with Triplone Tours");
  });
});

describe("channels", () => {
  it("runs the same tools and returns the same reply kinds on web and WhatsApp", async () => {
    await seed(db);
    const script: ScriptStep[] = [
      { tools: [{ name: "listDepartures", input: { tourSlug: "sylhet" } }] },
      { text: "Here you go:" },
    ];
    const web = await turn(script, { text: "Sylhet dates?" }, { channel: "web" });
    const wa = await turn(script, { text: "Sylhet dates?" }, { channel: "whatsapp" });
    expect(wa.replies).toEqual(web.replies);
    expect(lastPrompt(web.model)).toContain("website chat");
    expect(lastPrompt(wa.model)).toContain("on WhatsApp");
  });

  it("stores the inbound and every reply with its channel and sender", async () => {
    await seed(db);
    const { conversationId } = await turn(
      [
        { tools: [{ name: "listTours", input: {} }] },
        { text: "We run three tours:" },
      ],
      { text: "what tours do you have?" },
      { channel: "whatsapp" },
    );
    const stored = (await loadWindow(db, conversationId)).map((m) => [m.channel, m.direction, m.sentBy, m.body]);
    expect(stored).toEqual([
      ["whatsapp", "inbound", "customer", "what tours do you have?"],
      ["whatsapp", "outbound", "ai", "We run three tours:"],
      ["whatsapp", "outbound", "ai", "Which tour would you like?"],
    ]);
  });
});

describe("model failures", () => {
  const rateLimited = () =>
    new MockLanguageModelV4({
      doGenerate: async () => {
        throw new APICallError({ message: "rate limited", url: "https://api.groq.com", requestBodyValues: {}, statusCode: 429 });
      },
    });

  it("finishes the turn on the fallback model when the primary is rate limited", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await seed(db);
    const conversation = await newConversation(db);
    const { replies } = await runTurn({
      db,
      conversationId: conversation.id,
      channel: "web",
      inbound: { text: "hi" },
      now,
      models: [
        { id: "primary", model: rateLimited() },
        { id: "fallback", model: scriptedModel([{ text: "Hi! Which tour are you thinking about?" }]) },
      ],
    });
    expect(replies).toEqual([{ kind: "text", text: "Hi! Which tour are you thinking about?" }]);
  });

  it("returns the busy reply, with no price, when every model fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await seed(db);
    const conversation = await newConversation(db);
    const { replies } = await runTurn({
      db,
      conversationId: conversation.id,
      channel: "web",
      inbound: { text: "how much is the Sundarbans tour for 2?" },
      now,
      models: [
        { id: "primary", model: rateLimited() },
        { id: "fallback", model: rateLimited() },
      ],
    });
    expect(replies).toEqual([{ kind: "text", text: BUSY_REPLY }]);
    // The failed calls still count toward the limits.
    expect(await db.select().from(turns)).toEqual([expect.objectContaining({ model: null, inputTokens: 0, outputTokens: 0 })]);
    expect(error).toHaveBeenCalledWith("turn failed on every model: AI_APICallError 429");
    expect(JSON.stringify(error.mock.calls)).not.toContain("Sundarbans");
  });
});

describe("ownership", () => {
  it("drops the agent's reply when a person takes over during the turn", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { id: conversationId } = await newConversation(db, "whatsapp");
    // The model is slow; a person replies from the inbox meanwhile.
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        await transition(db, { conversationId, event: "human_replied" });
        return {
          content: [{ type: "text", text: "Hi! Which tour are you thinking of?" }],
          finishReason: { unified: "stop", raw: undefined },
          usage: { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } },
          warnings: [],
        };
      },
    });
    const turn = await runTurn({ db, conversationId, channel: "whatsapp", inbound: { text: "hello" }, now, models: only(model) });

    expect(turn).toEqual({ replies: [], messageIds: [] });
    const reply = (await loadWindow(db, conversationId)).find((m) => m.sentBy === "ai");
    expect(reply).toMatchObject({ body: "Hi! Which tour are you thinking of?", deliveryStatus: "suppressed" });
  });

  it("does not run a turn while a person owns the conversation", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { id: conversationId } = await newConversation(db, "whatsapp");
    await transition(db, { conversationId, event: "customer_requested" });
    const model = scriptedModel([{ text: "unused" }]);

    const turn = await runTurn({ db, conversationId, channel: "whatsapp", inbound: { text: "are you there?" }, now, models: only(model) });

    expect(turn.replies).toEqual([]);
    expect(model.doGenerateCalls).toHaveLength(0);
    expect((await loadWindow(db, conversationId)).at(-1)).toMatchObject({ sentBy: "customer", body: "are you there?" });
  });
});

describe("handoff", () => {
  it("hands a WhatsApp customer to a person with one message", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { replies, conversationId } = await turn(
      [{ tools: [{ name: "requestHuman", input: { reason: "asked_for_person" } }] }, { text: "Sure, connecting you now!" }],
      { text: "can I talk to a person" },
      { channel: "whatsapp" },
    );
    expect(replies).toEqual([{ kind: "handoff", text: "A person will reply here soon." }]);
    expect((await getConversation(db, conversationId))?.owner).toBe("human");
  });

  it("hands a cancellation to a person instead of answering it", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { replies, conversationId } = await turn(
      [{ tools: [{ name: "requestHuman", input: { reason: "cancel_booking" } }] }, { text: "Done." }],
      { text: "please cancel my booking" },
      { channel: "whatsapp" },
    );
    expect(replies).toEqual([{ kind: "handoff", text: "A person will reply here soon to help with the cancellation." }]);
    expect((await getConversation(db, conversationId))?.owner).toBe("human");
  });

  it("sends a web visitor to WhatsApp and keeps the conversation with the agent", async () => {
    const conversationId = (await newConversation(db, "web")).id;
    const model = scriptedModel([{ tools: [{ name: "requestHuman", input: { reason: "asked_for_person" } }] }, { text: "ok" }]);
    const { replies } = await runTurn({
      db,
      conversationId,
      channel: "web",
      inbound: { text: "I want to talk to someone" },
      now,
      models: only(model),
      whatsappNumber: "15550000000",
    });
    expect(replies).toEqual([
      {
        kind: "link",
        text: "A person from our team replies on WhatsApp. This link brings your chat with you.",
        url: expect.stringMatching(/^https:\/\/wa\.me\/15550000000\?text=Hi!%20My%20code%20is%20TR-/),
        label: "Continue on WhatsApp",
      },
    ]);
    await expectFreshCode(replies[0]!, conversationId);
    expect((await getConversation(db, conversationId))?.owner).toBe("ai");
  });

  it("gives a web visitor a WhatsApp link with a fresh code when they ask to move", async () => {
    const conversationId = (await newConversation(db, "web")).id;
    const model = scriptedModel([{ tools: [{ name: "continueOnWhatsApp", input: {} }] }, { text: "Here you go!" }]);
    const { replies } = await runTurn({
      db,
      conversationId,
      channel: "web",
      inbound: { text: "can we continue on whatsapp?" },
      now,
      models: only(model),
      whatsappNumber: "15550000000",
    });
    expect(replies).toEqual([
      expect.objectContaining({ kind: "link", label: "Continue on WhatsApp", url: expect.stringContaining("https://wa.me/15550000000?text=") }),
    ]);
    await expectFreshCode(replies[0]!, conversationId);
  });

  it("does not offer continueOnWhatsApp on WhatsApp", async () => {
    const { model } = await turn([{ text: "Hello!" }], { text: "hi" }, { channel: "whatsapp" });
    const offered = (model.doGenerateCalls[0]!.tools ?? []).map((t) => t.name);
    expect(offered).toContain("requestHuman");
    expect(offered).not.toContain("continueOnWhatsApp");
  });
});

// The link's prefilled text holds an unused code for this conversation that
// lasts 15 minutes from now.
async function expectFreshCode(reply: { kind: string; url?: string }, conversationId: string) {
  const code = findCode(decodeURIComponent(new URL(reply.url!).searchParams.get("text") ?? ""));
  expect(code).not.toBeNull();
  const [row] = await db.select().from(linkCodes).where(eq(linkCodes.code, code!));
  expect(row).toMatchObject({ conversationId, usedAt: null, expiresAt: new Date(now.getTime() + 15 * 60_000) });
}
