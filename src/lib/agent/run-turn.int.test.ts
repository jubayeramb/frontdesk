import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Channel } from "@/db/schema";
import { seed } from "@/db/seed-data";
import { getConversation, loadWindow } from "@/lib/conversations/store";
import { setupTestDb } from "../../../test/int/db";
import { newConversation } from "../../../test/int/fixtures";
import { scriptedModel, type ScriptStep } from "../../../test/support/scripted-model";
import type { NamedModel } from "./model";
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
  const replies = await runTurn({ db, conversationId, channel, inbound, now, models: only(model) });
  return { replies, model, conversationId };
}

const lastPrompt = (model: MockLanguageModelV4) => JSON.stringify(model.doGenerateCalls.at(-1)?.prompt);

describe("prices", () => {
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
        options: [
          { id: "sundarbans:2026-11-05", label: "Thu 5 Nov" },
          { id: "sundarbans:2026-11-08", label: "Sun 8 Nov" },
          { id: "sundarbans:2026-11-12", label: "Thu 12 Nov" },
          { id: "sundarbans:2026-11-15", label: "Sun 15 Nov" },
        ],
      },
    ]);
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
    const replies = await runTurn({
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
    const replies = await runTurn({
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
    expect(error).toHaveBeenCalledWith("turn failed on every model: AI_APICallError 429");
    expect(JSON.stringify(error.mock.calls)).not.toContain("Sundarbans");
  });
});
