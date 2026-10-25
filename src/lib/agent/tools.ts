import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db/client";
import { tours, type Channel } from "@/db/schema";
import { getConversation, updateState } from "@/lib/conversations/store";
import { bookDeparture } from "@/lib/departures/book";
import { departureLabel, listDepartures } from "@/lib/departures/departures";
import { formatBdt } from "@/lib/pricing/format";
import { getPriceList } from "@/lib/pricing/price-list";
import { computeQuote, matchTour, type Quote } from "@/lib/pricing/quote";
import { transition } from "@/lib/ownership";
import type { AgentReply, ChoicesReply } from "./replies";

export type TurnContext = {
  db: Db;
  conversationId: string;
  now: Date;
  channel?: Channel;
  // The number a web visitor is sent to for a person, digits only.
  whatsappNumber?: string;
};

// Everything the tools learned this turn. The presenter and the price guard
// read it instead of trusting the model's text.
export type TurnRecord = {
  choices?: ChoicesReply;
  choicesOf?: "tours" | "departures";
  booked?: boolean;
  // Set when the turn handed the customer to a person; it is the whole reply.
  handoff?: AgentReply;
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
          label: "View tours",
          options: rows.map((t) => ({ id: t.slug, label: t.name })),
        };
        record.choicesOf = "tours";
        return {
          ok: true as const,
          shownToCustomer: SHOWN_TO_CUSTOMER,
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
        // The customer named the tour, so tour options looked up first are moot.
        // Departures listed in the same turn are still what they pick from next.
        if (record.choicesOf === "tours") record.choices = undefined;
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
        "Make a new booking for a departure at the customer's latest quote. Call only after the customer picked a departure. It never changes or cancels an existing booking.",
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
        // A quote pays for one booking; the next one needs the travelers again.
        await updateState(ctx.db, ctx.conversationId, { booking }, ["quote"]);
        record.amounts.add(quote.totalBdt);
        record.choices = undefined;
        record.booked = true;
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

    requestHuman: tool({
      description:
        "Hand the customer to a person on our team. Use when they ask for a person, or to change or cancel a booking, which you cannot do.",
      inputSchema: z.object({
        reason: z.enum(["asked_for_person", "change_booking", "cancel_booking"]),
      }),
      execute: guarded("requestHuman", async ({ reason }: { reason: HandoffReason }) => {
        record.choices = undefined;
        if (ctx.channel === "whatsapp") {
          await transition(ctx.db, {
            conversationId: ctx.conversationId,
            event: "customer_requested",
            because: HANDOFF_NOTE[reason],
          });
          record.handoff = { kind: "handoff", text: HANDOFF_TEXT[reason] };
        } else {
          // People only reply on WhatsApp, so the web visitor is sent there.
          record.handoff = ctx.whatsappNumber
            ? {
                kind: "link",
                text: "A person from our team replies on WhatsApp.",
                url: `https://wa.me/${ctx.whatsappNumber}`,
                label: "Continue on WhatsApp",
              }
            : { kind: "text", text: "A person from our team replies on WhatsApp." };
        }
        return { ok: true as const, shownToCustomer: "The customer has been told a person will help. Write nothing more." };
      }),
    }),
  };

  return { tools, record };
}

type HandoffReason = "asked_for_person" | "change_booking" | "cancel_booking";

const HANDOFF_TEXT: Record<HandoffReason, string> = {
  asked_for_person: "A person will reply here soon.",
  change_booking: "A person will reply here soon to change your booking.",
  cancel_booking: "A person will reply here soon to help with the cancellation.",
};

// The note staff see in the conversation, so they know what to pick up.
const HANDOFF_NOTE: Record<HandoffReason, string> = {
  asked_for_person: "the customer asked for a person",
  change_booking: "the customer asked to change a booking",
  cancel_booking: "the customer asked to cancel a booking",
};

// Said in the result as well as the prompt: the model is likeliest to list the
// options right after it receives them. It names no widget, because the model
// echoes whatever word it is given ("tap a button below").
const SHOWN_TO_CUSTOMER =
  'The customer already sees these options under your reply. Lead in with one short sentence, like "Here are our tours.", and do not repeat them or say how they are shown.';

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

export async function offerDepartures(ctx: TurnContext, record: TurnRecord, tourSlug: string) {
  const tour = matchTour(await ctx.db.select().from(tours), tourSlug);
  if (!tour || !tour.active) {
    return { ok: false as const, error: `There is no bookable tour called "${tourSlug}".` };
  }
  const departures = listDepartures(tour, ctx.now);
  if (departures.length > 0) {
    record.choices = {
      kind: "choices",
      prompt: `Departures for ${tour.name}`,
      label: "View dates",
      options: departures.map((d) => ({ id: d.id, label: d.label })),
    };
    record.choicesOf = "departures";
  }
  return {
    ok: true as const,
    ...(departures.length > 0 ? { shownToCustomer: SHOWN_TO_CUSTOMER } : {}),
    tour: tour.name,
    departures: departures.map((d) => ({ departureId: d.id, label: d.label })),
  };
}
