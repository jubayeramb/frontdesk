import type { Db } from "./client";
import { priceList, tours } from "./schema";

// Default Triplone Tours packages. Prices are made up, in whole taka.
// Weekdays: 0 = Sunday ... 6 = Saturday.
export const DEFAULT_TOURS = [
  {
    slug: "sundarbans",
    name: "Sundarbans 3-day boat tour",
    summary:
      "Three days on a boat through the mangrove forest from Khulna, with guided forest walks and canal trips.",
    days: 3,
    pricePerPersonBdt: 14_500,
    departureWeekdays: [4, 0],
  },
  {
    slug: "sylhet",
    name: "Sylhet tea gardens 2-day",
    summary:
      "Tea estates around Srimangal and a boat ride through the Ratargul swamp forest.",
    days: 2,
    pricePerPersonBdt: 8_500,
    departureWeekdays: [5],
  },
  {
    slug: "bandarban",
    name: "Bandarban hills 3-day",
    summary:
      "Nilgiri hilltop, Shoilo Propat falls and a night in a hill village in the Chittagong Hill Tracts.",
    days: 3,
    pricePerPersonBdt: 12_000,
    departureWeekdays: [3, 6],
  },
] satisfies (typeof tours.$inferInsert)[];

// Safe to run any number of times: existing rows, including staff edits, are kept.
export async function seed(db: Db) {
  await db.transaction(async (tx) => {
    await tx.insert(tours).values(DEFAULT_TOURS).onConflictDoNothing({ target: tours.slug });
    await tx.insert(priceList).values({ id: 1 }).onConflictDoNothing({ target: priceList.id });
  });
}
