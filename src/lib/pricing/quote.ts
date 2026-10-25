import type { Tour } from "@/db/schema";

export const MIN_TRAVELERS = 1;
export const MAX_TRAVELERS = 10;

export type PricedTour = Pick<Tour, "slug" | "name" | "pricePerPersonBdt" | "active">;

export type PriceList = {
  version: number;
  tours: PricedTour[];
};

export type Quote = {
  tour: { slug: string; name: string };
  pricePerPersonBdt: number;
  travelers: number;
  totalBdt: number;
  priceListVersion: number;
};

export type QuoteError = {
  code: "unknown_tour" | "inactive_tour" | "travelers_out_of_range";
  message: string;
};

export type QuoteResult = { ok: true; quote: Quote } | { ok: false; error: QuoteError };

// The tour the model named. Models often pass the customer's words ("Sylhet
// tour") or a made-up slug ("sylhet-tea-gardens") instead of the slug, so the
// text matches when it is a slug or holds exactly one slug as a word. No
// match, or several, is unknown: asking beats guessing a price.
export function matchTour<T extends { slug: string }>(tours: T[], text: string): T | undefined {
  const lower = text.trim().toLowerCase();
  const exact = tours.find((t) => t.slug === lower);
  if (exact) return exact;
  const words = new Set(lower.split(/[^a-z0-9]+/));
  const named = tours.filter((t) => words.has(t.slug));
  return named.length === 1 ? named[0] : undefined;
}

// Errors are values, not exceptions: the agent hands them to the model as data.
export function computeQuote(
  priceList: PriceList,
  input: { tourSlug: string; travelers: number },
): QuoteResult {
  const tour = matchTour(priceList.tours, input.tourSlug);
  if (!tour) {
    return fail("unknown_tour", `There is no tour called "${input.tourSlug}".`);
  }
  if (!tour.active) {
    return fail("inactive_tour", `${tour.name} is not taking bookings right now.`);
  }
  const { travelers } = input;
  if (!Number.isInteger(travelers) || travelers < MIN_TRAVELERS || travelers > MAX_TRAVELERS) {
    return fail(
      "travelers_out_of_range",
      `Bookings take ${MIN_TRAVELERS} to ${MAX_TRAVELERS} travelers.`,
    );
  }
  return {
    ok: true,
    quote: {
      tour: { slug: tour.slug, name: tour.name },
      pricePerPersonBdt: tour.pricePerPersonBdt,
      travelers,
      totalBdt: tour.pricePerPersonBdt * travelers,
      priceListVersion: priceList.version,
    },
  };
}

function fail(code: QuoteError["code"], message: string): QuoteResult {
  return { ok: false, error: { code, message } };
}
