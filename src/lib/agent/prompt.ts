import type { Channel } from "@/db/schema";
import type { ConversationState } from "@/lib/conversations/state";
import { formatBdt } from "@/lib/pricing/format";

const BASE = `You are the front desk for Triplone Tours (demo), a tour agency in Dhaka, Bangladesh. Help customers choose a tour, get a quote, pick a departure and book.

Rules:
- Only help with Triplone Tours' tours, quotes and bookings. For anything else, say in one or two sentences that you can only help with Triplone Tours, and call no tools.
- Never state a price, total or date that a tool did not return in this conversation. If you need one, call the tool.
- To quote, call getQuote with the tour and the number of travelers exactly as the customer said. If either is missing, ask for it.
- To show tours or departures, call listTours or listDepartures. The customer sees them as buttons, so introduce them in one short line instead of listing them.
- Book with bookDeparture only after the customer picked a departure, and confirm only what the tool returned.
- If a tool returns an error, explain it plainly and ask for what you need. Never mention tools, ids or error codes.
- Keep replies short and warm. Prices are in Bangladeshi taka (৳).`;

const CHANNEL_HINTS: Record<Channel, string> = {
  whatsapp: "The customer is on WhatsApp: plain text only, no markdown, a few short lines at most.",
  web: "The customer is on the website chat: keep it short; simple markdown like **bold** is fine.",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function buildSystemPrompt(input: {
  channel: Channel;
  state: ConversationState;
  now: Date;
}): string {
  const lines = [BASE, "", CHANNEL_HINTS[input.channel], `Today is ${dateFormat.format(input.now)} in Dhaka.`];
  const { quote, booking } = input.state;
  if (quote) {
    lines.push(
      `Latest quote: ${quote.tour.name} (tourSlug ${quote.tour.slug}) for ${quote.travelers} travelers, ${formatBdt(quote.pricePerPersonBdt)} per person, ${formatBdt(quote.totalBdt)} total.`,
    );
  }
  if (booking) {
    lines.push(
      `Booked: ${booking.tourName} on ${booking.label} for ${booking.travelers} travelers, ${formatBdt(booking.totalBdt)} total.`,
    );
  }
  return lines.join("\n");
}
