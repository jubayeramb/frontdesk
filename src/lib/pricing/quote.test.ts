import { describe, expect, it } from "vitest";

import { formatBdt } from "./format";
import { computeQuote, type PriceList } from "./quote";

const priceList: PriceList = {
  version: 7,
  tours: [
    { slug: "sundarbans", name: "Sundarbans 3-day boat tour", pricePerPersonBdt: 14_500, active: true },
    { slug: "sylhet", name: "Sylhet tea gardens 2-day", pricePerPersonBdt: 8_500, active: false },
  ],
};

describe("computeQuote", () => {
  it("multiplies the per-person price by travelers and carries the version", () => {
    const result = computeQuote(priceList, { tourSlug: "sundarbans", travelers: 4 });
    expect(result).toEqual({
      ok: true,
      quote: {
        tour: { slug: "sundarbans", name: "Sundarbans 3-day boat tour" },
        pricePerPersonBdt: 14_500,
        travelers: 4,
        totalBdt: 58_000,
        priceListVersion: 7,
      },
    });
  });

  it.each([0, 11, 2.5, -1])("rejects %s travelers and names the range", (travelers) => {
    const result = computeQuote(priceList, { tourSlug: "sundarbans", travelers });
    expect(result).toEqual({
      ok: false,
      error: { code: "travelers_out_of_range", message: "Bookings take 1 to 10 travelers." },
    });
  });

  it("accepts the edges of the range", () => {
    expect(computeQuote(priceList, { tourSlug: "sundarbans", travelers: 1 }).ok).toBe(true);
    expect(computeQuote(priceList, { tourSlug: "sundarbans", travelers: 10 }).ok).toBe(true);
  });

  it("rejects an inactive tour by name", () => {
    const result = computeQuote(priceList, { tourSlug: "sylhet", travelers: 2 });
    expect(result).toMatchObject({ ok: false, error: { code: "inactive_tour" } });
    expect(!result.ok && result.error.message).toContain("Sylhet tea gardens 2-day");
  });

  it("rejects an unknown tour", () => {
    const result = computeQuote(priceList, { tourSlug: "cox", travelers: 2 });
    expect(result).toMatchObject({ ok: false, error: { code: "unknown_tour" } });
  });
});

describe("formatBdt", () => {
  it.each([
    [58_000, "৳58,000"],
    [8_500, "৳8,500"],
    [145_000, "৳145,000"],
    [0, "৳0"],
  ])("formats %d as %s", (amount, expected) => {
    expect(formatBdt(amount)).toBe(expected);
  });
});
