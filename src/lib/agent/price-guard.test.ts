import { describe, expect, it } from "vitest";

import { findAmounts, guardPrices } from "./price-guard";

const quote = {
  tour: { slug: "sundarbans", name: "Sundarbans 3-day boat tour" },
  pricePerPersonBdt: 14_500,
  travelers: 4,
  totalBdt: 58_000,
  priceListVersion: 2,
};

describe("findAmounts", () => {
  it.each([
    ["That's ৳58,000 in total.", [58_000]],
    ["৳ 14,500 per person, Tk 58000 total", [14_500, 58_000]],
    ["BDT 58,000 or 58,000 taka", [58_000, 58_000]],
    ["about $480", [480]],
    ["₨14,500 each, Rs. 29,000 total", [14_500, 29_000]],
    ["4 travelers on 5 Nov, 3 days", []],
  ])("%s", (text, expected) => {
    expect(findAmounts(text)).toEqual(expected);
  });
});

describe("guardPrices", () => {
  it("keeps a reply whose amounts all came from tools", () => {
    const result = guardPrices({
      text: "4 travelers at ৳14,500 each comes to **৳58,000**.",
      allowed: new Set([14_500, 58_000]),
      state: {},
      turnQuote: quote,
    });
    expect(result).toEqual({ text: "4 travelers at ৳14,500 each comes to **৳58,000**.", replaced: false });
  });

  it("replaces a reply with an invented amount by the code-built quote", () => {
    const result = guardPrices({
      text: "That comes to ৳50,000.",
      allowed: new Set([14_500, 58_000]),
      state: {},
      turnQuote: quote,
    });
    expect(result).toEqual({
      text: "Sundarbans 3-day boat tour for 4 travelers: ৳14,500 per person, ৳58,000 total.",
      replaced: true,
    });
  });

  it("allows the stored quote's amounts on a later turn", () => {
    const result = guardPrices({ text: "Your quote is still ৳58,000.", allowed: new Set(), state: { quote } });
    expect(result.replaced).toBe(false);
  });

  it("rejects the stored quote's old total once a new quote replaced it", () => {
    const newQuote = { ...quote, pricePerPersonBdt: 15_000, totalBdt: 60_000, priceListVersion: 3 };
    const result = guardPrices({
      text: "Still ৳58,000 for four.",
      allowed: new Set([15_000, 60_000]),
      state: { quote },
      turnQuote: newQuote,
    });
    expect(result).toEqual({
      text: "Sundarbans 3-day boat tour for 4 travelers: ৳15,000 per person, ৳60,000 total.",
      replaced: true,
    });
  });

  it("asks for details when there is no quote to fall back on", () => {
    const result = guardPrices({ text: "Tours start at ৳5,000.", allowed: new Set(), state: {} });
    expect(result.text).toBe("I can give you an exact price. Which tour, and how many travelers?");
  });
});
