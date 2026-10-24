import { describe, expect, it, vi } from "vitest";

import { seed } from "@/db/seed-data";
import { getConversation } from "@/lib/conversations/store";
import { updatePrices } from "@/lib/pricing/price-list";
import { setupTestDb } from "../../../test/int/db";
import { newConversation } from "../../../test/int/fixtures";
import { createTurnTools } from "./tools";

const db = setupTestDb();
// Monday 2 November 2026, 10:00 in Dhaka.
const now = new Date("2026-11-02T10:00:00+06:00");
const call = { toolCallId: "call-1", messages: [], context: {} };

// Tool execute() may stream; ours never do, so unwrap the plain result.
async function result<T>(value: T | PromiseLike<T> | AsyncIterable<T>): Promise<T> {
  const resolved = await value;
  if (resolved && typeof resolved === "object" && Symbol.asyncIterator in resolved) {
    throw new Error("unexpected streaming tool result");
  }
  return resolved as T;
}

async function setup() {
  await seed(db);
  const conversation = await newConversation(db);
  return { conversation, ...createTurnTools({ db, conversationId: conversation.id, now }) };
}

describe("listTours", () => {
  it("returns active tours with prices and offers them as choices", async () => {
    const { tools, record } = await setup();
    await updatePrices(db, [{ slug: "bandarban", pricePerPersonBdt: 12_000, active: false }]);
    const listed = await result(tools.listTours.execute!({}, call));
    if (!listed.ok) throw new Error(listed.error);
    expect(listed.tours.map((t) => [t.tourSlug, t.pricePerPerson])).toEqual([
      ["sundarbans", "৳14,500"],
      ["sylhet", "৳8,500"],
    ]);
    expect(record.choices).toEqual({
      kind: "choices",
      prompt: "Which tour would you like?",
      label: "View tours",
      options: [
        { id: "sundarbans", label: "Sundarbans 3-day boat tour" },
        { id: "sylhet", label: "Sylhet tea gardens 2-day" },
      ],
    });
    expect([...record.amounts]).toEqual([14_500, 8_500]);
  });
});

describe("getQuote", () => {
  it("quotes from the database, stores the quote and records the amounts", async () => {
    const { tools, record, conversation } = await setup();
    const result = await tools.getQuote.execute!({ tourSlug: "sundarbans", travelers: 4 }, call);
    expect(result).toEqual({
      ok: true,
      tour: "Sundarbans 3-day boat tour",
      travelers: 4,
      pricePerPerson: "৳14,500",
      total: "৳58,000",
      priceListVersion: 1,
    });
    expect((await getConversation(db, conversation.id))?.state.quote?.totalBdt).toBe(58_000);
    expect(record.amounts).toEqual(new Set([14_500, 58_000]));
    expect(record.choices).toBeUndefined();
  });

  it("returns the validation message as data", async () => {
    const { tools } = await setup();
    const result = await tools.getQuote.execute!({ tourSlug: "sundarbans", travelers: 15 }, call);
    expect(result).toEqual({ ok: false, error: "Bookings take 1 to 10 travelers." });
  });
});

describe("listDepartures", () => {
  it("returns departures and offers exactly those as choices", async () => {
    const { tools, record } = await setup();
    const departures = await result(tools.listDepartures.execute!({ tourSlug: "sundarbans" }, call));
    expect(departures).toMatchObject({ ok: true, tour: "Sundarbans 3-day boat tour" });
    const ids = departures.ok ? departures.departures.map((d) => d.departureId) : [];
    expect(ids).toEqual([
      "sundarbans:2026-11-05",
      "sundarbans:2026-11-08",
      "sundarbans:2026-11-12",
      "sundarbans:2026-11-15",
    ]);
    expect(record.choices?.options.map((o) => o.id)).toEqual(ids);
    expect(record.choices?.options[0]?.label).toBe("Thu 5 Nov");
  });
});

describe("choices within one turn", () => {
  it("keeps the departures when the same turn also quotes the tour", async () => {
    const { tools, record } = await setup();
    await tools.listDepartures.execute!({ tourSlug: "bandarban" }, call);
    await tools.getQuote.execute!({ tourSlug: "bandarban", travelers: 4 }, call);
    expect(record.choices?.prompt).toBe("Departures for Bandarban hills 3-day");
  });

  it("drops the tour options once the tour is quoted", async () => {
    const { tools, record } = await setup();
    await tools.listTours.execute!({}, call);
    await tools.getQuote.execute!({ tourSlug: "bandarban", travelers: 4 }, call);
    expect(record.choices).toBeUndefined();
  });
});

describe("bookDeparture", () => {
  it("refuses to book without a quote", async () => {
    const { tools } = await setup();
    const result = await tools.bookDeparture.execute!({ departureId: "sundarbans:2026-11-05" }, call);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("no quote") });
  });

  it("books the quoted tour and stores the booking in the state", async () => {
    const { tools, conversation } = await setup();
    await tools.getQuote.execute!({ tourSlug: "sundarbans", travelers: 2 }, call);
    const result = await tools.bookDeparture.execute!({ departureId: "sundarbans:2026-11-08" }, call);
    expect(result).toMatchObject({
      ok: true,
      tour: "Sundarbans 3-day boat tour",
      departsOn: "2026-11-08",
      travelers: 2,
      total: "৳29,000",
    });
    expect((await getConversation(db, conversation.id))?.state.booking).toMatchObject({
      label: "Sun 8 Nov",
      totalBdt: 29_000,
    });
  });

  it("uses a quote for one booking only, so a later pick asks for the travelers again", async () => {
    const { tools, conversation } = await setup();
    await tools.getQuote.execute!({ tourSlug: "sylhet", travelers: 3 }, call);
    expect(await tools.bookDeparture.execute!({ departureId: "sylhet:2026-11-06" }, call)).toMatchObject({ ok: true, travelers: 3 });

    // Seen on a real phone: days later the customer picked another Sylhet date
    // and was booked for the 3 travelers of the old quote.
    const later = createTurnTools({ db, conversationId: conversation.id, now });
    const result = await later.tools.bookDeparture.execute!({ departureId: "sylhet:2026-11-13" }, call);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("no quote") });
    const state = (await getConversation(db, conversation.id))?.state;
    expect(state?.quote).toBeUndefined();
    expect(state?.booking).toMatchObject({ departsOn: "2026-11-06", travelers: 3 });
  });

  it("offers current departures when the one picked is no longer available", async () => {
    const { tools, record } = await setup();
    await tools.getQuote.execute!({ tourSlug: "sundarbans", travelers: 2 }, call);
    const result = await tools.bookDeparture.execute!({ departureId: "sundarbans:2026-11-02" }, call);
    expect(result).toMatchObject({ ok: false, currentDepartures: { ok: true } });
    expect(record.choices?.options[0]?.id).toBe("sundarbans:2026-11-05");
  });
});

describe("tool failures", () => {
  it("reach the model as a plain message, without SQL or internals", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = new Proxy(db, {
      get: () => () => {
        throw new Error('relation "tours" does not exist');
      },
    });
    const { tools } = createTurnTools({ db: broken, conversationId: "c", now });
    const listed = await result(tools.listTours.execute!({}, call));
    expect(listed).toEqual({ ok: false, error: "Something went wrong on our side. Try again in a moment." });
    expect(JSON.stringify(listed)).not.toContain("relation");
    expect(error).toHaveBeenCalledWith("tool listTours failed:", expect.any(Error));
    error.mockRestore();
  });
});
