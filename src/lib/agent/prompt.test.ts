import { describe, expect, it } from "vitest";

import { buildSystemPrompt } from "./prompt";

const now = new Date("2026-11-02T10:00:00+06:00");
// A rough, conservative estimate: about 4 characters per token for English.
const approxTokens = (text: string) => Math.ceil(text.length / 4);

describe("buildSystemPrompt", () => {
  it("stays within a small token budget, even with a quote and a booking", () => {
    const prompt = buildSystemPrompt({
      channel: "whatsapp",
      now,
      state: {
        quote: {
          tour: { slug: "sundarbans", name: "Sundarbans 3-day boat tour" },
          pricePerPersonBdt: 14_500,
          travelers: 4,
          totalBdt: 58_000,
          priceListVersion: 3,
        },
        booking: {
          id: 7,
          tourSlug: "sundarbans",
          tourName: "Sundarbans 3-day boat tour",
          departsOn: "2026-11-05",
          label: "Thu 5 Nov",
          travelers: 4,
          totalBdt: 58_000,
        },
      },
    });
    expect(approxTokens(prompt)).toBeLessThan(450);
  });

  it("adds the channel hint and today's Dhaka date", () => {
    const wa = buildSystemPrompt({ channel: "whatsapp", state: {}, now });
    const web = buildSystemPrompt({ channel: "web", state: {}, now });
    expect(wa).toContain("on WhatsApp: plain text only");
    expect(web).toContain("on the website chat");
    expect(wa).toContain("Today is Mon, 2 Nov 2026 in Dhaka.");
  });

  it("summarizes the latest quote so it survives the history window", () => {
    const prompt = buildSystemPrompt({
      channel: "web",
      now,
      state: {
        quote: {
          tour: { slug: "sylhet", name: "Sylhet tea gardens 2-day" },
          pricePerPersonBdt: 8_500,
          travelers: 3,
          totalBdt: 25_500,
          priceListVersion: 1,
        },
      },
    });
    expect(prompt).toContain("Latest quote: Sylhet tea gardens 2-day (tourSlug sylhet) for 3 travelers");
    expect(prompt).toContain("৳25,500 total");
  });

  it("keeps the scope rule", () => {
    expect(buildSystemPrompt({ channel: "web", state: {}, now })).toContain(
      "Only help with Triplone Tours' tours, quotes and bookings",
    );
  });
});
