import { describe, expect, it } from "vitest";

import { seed } from "@/db/seed-data";
import { setupTestDb } from "../../../test/int/db";
import { getPriceList, updatePrices } from "./price-list";
import { computeQuote } from "./quote";

const db = setupTestDb();

describe("getPriceList", () => {
  it("reads the seeded tours with the current version", async () => {
    await seed(db);
    const list = await getPriceList(db);
    expect(list.version).toBe(1);
    expect(list.tours.map((t) => [t.slug, t.pricePerPersonBdt])).toEqual([
      ["sundarbans", 14_500],
      ["sylhet", 8_500],
      ["bandarban", 12_000],
    ]);
  });
});

describe("updatePrices", () => {
  it("saves a new price and raises the version by exactly one", async () => {
    await seed(db);
    const result = await updatePrices(db, [
      { slug: "sylhet", pricePerPersonBdt: 9_000, active: true },
    ]);
    expect(result).toEqual({ ok: true, version: 2 });
    const list = await getPriceList(db);
    expect(list.version).toBe(2);
    expect(list.tours.find((t) => t.slug === "sylhet")?.pricePerPersonBdt).toBe(9_000);
  });

  it("a new quote uses the new price and version, and the old total is gone", async () => {
    await seed(db);
    const before = computeQuote(await getPriceList(db), { tourSlug: "sundarbans", travelers: 4 });
    await updatePrices(db, [{ slug: "sundarbans", pricePerPersonBdt: 15_000, active: true }]);
    const after = computeQuote(await getPriceList(db), { tourSlug: "sundarbans", travelers: 4 });

    expect(before).toMatchObject({ ok: true, quote: { totalBdt: 58_000, priceListVersion: 1 } });
    expect(after).toMatchObject({ ok: true, quote: { totalBdt: 60_000, priceListVersion: 2 } });
    expect(JSON.stringify(after)).not.toContain("58000");
  });

  it.each([
    ["negative", -100, "The price must be more than zero."],
    ["non-numeric", "abc", "Enter a price in taka."],
  ])("refuses a %s price, names the field and keeps the version", async (_label, price, message) => {
    await seed(db);
    const result = await updatePrices(db, [
      { slug: "sylhet", pricePerPersonBdt: price as number, active: true },
    ]);
    expect(result).toEqual({ ok: false, fieldErrors: { "sylhet.pricePerPersonBdt": message } });
    const list = await getPriceList(db);
    expect(list.version).toBe(1);
    expect(list.tours.find((t) => t.slug === "sylhet")?.pricePerPersonBdt).toBe(8_500);
  });

  it("rolls back every edit if one tour is unknown", async () => {
    await seed(db);
    await expect(
      updatePrices(db, [
        { slug: "sylhet", pricePerPersonBdt: 9_000, active: true },
        { slug: "nowhere", pricePerPersonBdt: 1_000, active: true },
      ]),
    ).rejects.toThrow('Unknown tour "nowhere".');
    const list = await getPriceList(db);
    expect(list.version).toBe(1);
    expect(list.tours.find((t) => t.slug === "sylhet")?.pricePerPersonBdt).toBe(8_500);
  });
});
