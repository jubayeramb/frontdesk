import { expect, it } from "vitest";

import { bookings } from "@/db/schema";
import { seed } from "@/db/seed-data";
import { getPriceList } from "@/lib/pricing/price-list";
import { computeQuote, type Quote } from "@/lib/pricing/quote";
import { setupTestDb } from "../../../test/int/db";
import { newConversation } from "../../../test/int/fixtures";
import { bookDeparture } from "./book";

const db = setupTestDb();
// Monday 2 November 2026, 10:00 in Dhaka. Sundarbans leaves Thu and Sun.
const now = new Date("2026-11-02T10:00:00+06:00");

async function sundarbansQuote(travelers: number): Promise<Quote> {
  const result = computeQuote(await getPriceList(db), { tourSlug: "sundarbans", travelers });
  if (!result.ok) throw new Error(result.error.message);
  return result.quote;
}

it("stores a booking for an offered departure with the quote snapshot", async () => {
  await seed(db);
  const { id: conversationId } = await newConversation(db);
  const quote = await sundarbansQuote(4);

  const result = await bookDeparture(db, {
    conversationId,
    departureId: "sundarbans:2026-11-05",
    quote,
    now,
  });

  expect(result).toMatchObject({
    ok: true,
    booking: { conversationId, departsOn: "2026-11-05", travelers: 4 },
  });
  const [stored] = await db.select().from(bookings);
  expect(stored?.quote).toEqual(quote);
  expect(stored?.quote.priceListVersion).toBe(1);
});

it.each([
  ["a date the tour does not leave on", "sundarbans:2026-11-06"],
  ["a departure within 48 hours", "sundarbans:2026-11-02"],
  ["an unknown tour", "nowhere:2026-11-05"],
  ["a malformed id", "sundarbans"],
])("refuses %s and stores nothing", async (_label, departureId) => {
  await seed(db);
  const result = await bookDeparture(db, {
    conversationId: (await newConversation(db)).id,
    departureId,
    quote: await sundarbansQuote(2),
    now,
  });
  expect(result).toMatchObject({ ok: false, reason: "unavailable" });
  expect(await db.select().from(bookings)).toHaveLength(0);
});

it("refuses a quote for a different tour", async () => {
  await seed(db);
  const result = await bookDeparture(db, {
    conversationId: (await newConversation(db)).id,
    departureId: "sylhet:2026-11-06",
    quote: await sundarbansQuote(2),
    now,
  });
  expect(result).toMatchObject({ ok: false, reason: "quote_mismatch" });
  expect(await db.select().from(bookings)).toHaveLength(0);
});
