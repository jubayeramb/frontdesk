import { eq } from "drizzle-orm";

import type { Db } from "@/db/client";
import { bookings, tours, type Booking } from "@/db/schema";
import type { Quote } from "@/lib/pricing/quote";
import { listDepartures, parseDepartureId } from "./departures";

export type BookDepartureResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "unavailable" | "quote_mismatch"; message: string };

// Stores a booking if the departure is still offered and the quote matches it.
export async function bookDeparture(
  db: Db,
  input: { conversationId: string; departureId: string; quote: Quote; now: Date },
): Promise<BookDepartureResult> {
  const parsed = parseDepartureId(input.departureId);
  const [tour] = parsed
    ? await db.select().from(tours).where(eq(tours.slug, parsed.tourSlug))
    : [];
  const offered =
    parsed && tour && listDepartures(tour, input.now).some((d) => d.id === input.departureId);
  if (!parsed || !tour || !offered) {
    return {
      ok: false,
      reason: "unavailable",
      message: "That departure is not available. Pick one of the current departures.",
    };
  }
  if (input.quote.tour.slug !== tour.slug) {
    return {
      ok: false,
      reason: "quote_mismatch",
      message: "The quote is for a different tour. Get a quote for this tour first.",
    };
  }

  const [booking] = await db
    .insert(bookings)
    .values({
      conversationId: input.conversationId,
      tourId: tour.id,
      departsOn: parsed.departsOn,
      travelers: input.quote.travelers,
      quote: input.quote,
    })
    .returning();
  return { ok: true, booking: booking! };
}
