import { eq } from "drizzle-orm";
import { expect, it } from "vitest";

import { setupTestDb } from "../../test/int/db";
import { priceList, tours } from "./schema";
import { DEFAULT_TOURS, seed } from "./seed-data";

const db = setupTestDb();

it("loads the three default tours and a price list at version 1", async () => {
  await seed(db);
  const rows = await db.select().from(tours).orderBy(tours.id);
  expect(rows.map((t) => t.slug)).toEqual(DEFAULT_TOURS.map((t) => t.slug));
  const [list] = await db.select().from(priceList);
  expect(list?.version).toBe(1);
});

it("seeding twice creates no duplicates and keeps staff edits", async () => {
  await seed(db);
  await db
    .update(tours)
    .set({ pricePerPersonBdt: 9_000 })
    .where(eq(tours.slug, "sylhet"));
  await db.update(priceList).set({ version: 2 });

  await seed(db);

  const rows = await db.select().from(tours);
  expect(rows).toHaveLength(DEFAULT_TOURS.length);
  expect(rows.find((t) => t.slug === "sylhet")?.pricePerPersonBdt).toBe(9_000);
  const lists = await db.select().from(priceList);
  expect(lists).toEqual([expect.objectContaining({ version: 2 })]);
});
