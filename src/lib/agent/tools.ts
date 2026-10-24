import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db/client";
import { tours } from "@/db/schema";
import { getConversation, updateState } from "@/lib/conversations/store";
import { bookDeparture } from "@/lib/departures/book";
import { departureLabel, listDepartures } from "@/lib/departures/departures";
import { formatBdt } from "@/lib/pricing/format";
import { getPriceList } from "@/lib/pricing/price-list";
import { computeQuote, type Quote } from "@/lib/pricing/quote";
import type { ChoicesReply } from "./replies";

export type TurnContext = { db: Db; conversationId: string; now: Date };

// Everything the tools learned this turn. The presenter and the price guard
// read it instead of trusting the model's text.
export type TurnRecord = {
  choices?: ChoicesReply;
  amounts: Set<number>;
  quote?: Quote;
};

export function createTurnTools(ctx: TurnContext) {
  const record: TurnRecord = { amounts: new Set() };

  const tools = {
    listTours: tool({
      description: "List the tours Triplone Tours offers, with the price per person.",
      inputSchema: z.object({}),
      execute: guarded("listTours", async () => {
        const rows = await ctx.db.select().from(tours).where(eq(tours.active, true)).orderBy(tours.id);
        rows.forEach((t) => record.amounts.add(t.pricePerPersonBdt));
        record.choices = {
          kind: "choices",
          prompt: "Which tour would you like?",
          options: rows.map((t) => ({ id: t.slug, label: t.name })),
        };
        return {
          ok: true as const,
          tours: rows.map((t) => ({
            tourSlug: t.slug,
            name: t.name,
            days: t.days,
            summary: t.summary,
            pricePerPerson: formatBdt(t.pricePerPersonBdt),
          })),
        };
      }),
    }),

    getQuote: tool({
      description:
        "Quote a tour. Pass the customer's own words for the tour and the number of travelers; never adjust them.",
      inputSchema: z.object({
        tourSlug: z.string().describe("tourSlug from listTours"),
        travelers: z.number().int().describe("How many people are travelling"),
      }),
      execute: guarded("getQuote", async ({ tourSlug, travelers }: { tourSlug: string; travelers: number }) => {
        const result = computeQuote(await getPriceList(ctx.db), { tourSlug, travelers });
        if (!result.ok) return { ok: false as const, error: result.error.message };
        const { quote } = result;
        await updateState(ctx.db, ctx.conversationId, { quote });
        record.quote = quote;
        record.amounts.add(quote.pricePerPersonBdt).add(quote.totalBdt);
        return {
          ok: true as const,
          tour: quote.tour.name,
          travelers: quote.travelers,
          pricePerPerson: formatBdt(quote.pricePerPersonBdt),
          total: formatBdt(quote.totalBdt),
          priceListVersion: quote.priceListVersion,
        };
      }),
    }),

    listDepartures: tool({
      description: "List the upcoming departures for one tour.",
      inputSchema: z.object({ tourSlug: z.string().describe("tourSlug from listTours") }),
      execute: guarded("listDepartures", async ({ tourSlug }: { tourSlug: string }) =>
        offerDepartures(ctx, record, tourSlug),
      ),
    }),

    bookDeparture: tool({
      description:
        "Book a departure for the customer's latest quote. Call only after the customer picked a departure.",
      inputSchema: z.object({ departureId: z.string().describe("departure id from listDepartures") }),
      execute: guarded("bookDeparture", async ({ departureId }: { departureId: string }) => {
        const quote = (await getConversation(ctx.db, ctx.conversationId))?.state.quote;
        if (!quote) {
          return { ok: false as const, error: "There is no quote yet. Get a quote before booking." };
        }
        const result = await bookDeparture(ctx.db, {
          conversationId: ctx.conversationId,
          departureId,
          quote,
          now: ctx.now,
        });
        if (!result.ok) {
          // Offer what is still available so the customer can pick again.
          const current = await offerDepartures(ctx, record, quote.tour.slug);
          return { ok: false as const, error: result.message, currentDepartures: current };
        }
        const label = departureLabel(result.booking.departsOn);
        const booking = {
          id: result.booking.id,
          tourSlug: quote.tour.slug,
          tourName: quote.tour.name,
          departsOn: result.booking.departsOn,
          label,
          travelers: quote.travelers,
          totalBdt: quote.totalBdt,
        };
        await updateState(ctx.db, ctx.conversationId, { booking });
        record.amounts.add(quote.totalBdt);
        return {
          ok: true as const,
          bookingReference: `TR-${String(booking.id).padStart(5, "0")}`,
          tour: quote.tour.name,
          departsOn: booking.departsOn,
          travelers: quote.travelers,
          total: formatBdt(quote.totalBdt),
        };
      }),
    }),
  };

  return { tools, record };
}

export const TOOL_FAILED = {
  ok: false as const,
  error: "Something went wrong on our side. Try again in a moment.",
};

// A thrown error (a database hiccup, a bug) reaches the model as a plain
// message, never as SQL or a stack trace. The details go to the server log.
function guarded<I, O>(name: string, execute: (input: I) => Promise<O>) {
  return async (input: I): Promise<O | typeof TOOL_FAILED> => {
    try {
      return await execute(input);
    } catch (error) {
      console.error(`tool ${name} failed:`, error);
      return TOOL_FAILED;
    }
  };
}

async function offerDepartures(ctx: TurnContext, record: TurnRecord, tourSlug: string) {
  const [tour] = await ctx.db.select().from(tours).where(eq(tours.slug, tourSlug));
  if (!tour || !tour.active) {
    return { ok: false as const, error: `There is no bookable tour called "${tourSlug}".` };
  }
  const departures = listDepartures(tour, ctx.now);
  if (departures.length > 0) {
    record.choices = {
      kind: "choices",
      prompt: `Departures for ${tour.name}`,
      options: departures.map((d) => ({ id: d.id, label: d.label })),
    };
  }
  return {
    ok: true as const,
    tour: tour.name,
    departures: departures.map((d) => ({ departureId: d.id, label: d.label })),
  };
}
