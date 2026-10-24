import type { ConversationState } from "@/lib/conversations/state";
import { formatBdt } from "@/lib/pricing/format";
import type { Quote } from "@/lib/pricing/quote";

// Amounts written with a currency mark: ৳58,000, Tk 58000, BDT 58,000,
// 58,000 taka, $580. The model sometimes writes taka with the rupee sign.
const AMOUNT = /(?:৳|₨|\$|\bTk\.?|\bRs\.?|\bBDT)\s*(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*(?:taka|tk\b|bdt\b)/gi;

export function findAmounts(text: string): number[] {
  return [...text.matchAll(AMOUNT)].map((m) => Number((m[1] ?? m[2]!).replace(/,/g, "")));
}

// Every amount in the reply must come from a tool this turn or the stored quote
// or booking. Otherwise the reply is replaced with one built from the data.
export function guardPrices(input: {
  text: string;
  allowed: Set<number>;
  state: ConversationState;
  turnQuote?: Quote;
}): { text: string; replaced: boolean } {
  const allowed = new Set(input.allowed);
  const stored = input.state.quote;
  // A quote made this turn supersedes the stored one, so the old total is no
  // longer a valid thing to say.
  if (stored && !input.turnQuote) allowed.add(stored.pricePerPersonBdt).add(stored.totalBdt);
  if (input.state.booking) allowed.add(input.state.booking.totalBdt);

  const invented = findAmounts(input.text).filter((amount) => !allowed.has(amount));
  if (invented.length === 0) return { text: input.text, replaced: false };
  return { text: quoteText(input.turnQuote ?? stored), replaced: true };
}

export function quoteText(quote: Quote | undefined): string {
  if (!quote) return "I can give you an exact price. Which tour, and how many travelers?";
  return `${quote.tour.name} for ${quote.travelers} ${quote.travelers === 1 ? "traveler" : "travelers"}: ${formatBdt(quote.pricePerPersonBdt)} per person, ${formatBdt(quote.totalBdt)} total.`;
}
