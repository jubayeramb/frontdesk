import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db/client";
import { priceList, tours } from "@/db/schema";
import type { PriceList } from "./quote";

// Reads tours and the version in one transaction so a quote never mixes versions.
export async function getPriceList(db: Db): Promise<PriceList> {
  return db.transaction(async (tx) => {
    const [list] = await tx.select({ version: priceList.version }).from(priceList);
    if (!list) throw new Error("price_list is empty. Run `pnpm db:seed`.");
    const rows = await tx
      .select({
        slug: tours.slug,
        name: tours.name,
        pricePerPersonBdt: tours.pricePerPersonBdt,
        active: tours.active,
      })
      .from(tours)
      .orderBy(tours.id);
    return { version: list.version, tours: rows };
  });
}

export const priceChangesSchema = z
  .array(
    z.object({
      slug: z.string().min(1),
      pricePerPersonBdt: z.coerce
        .number({ error: "Enter a price in taka." })
        .int("Use whole taka.")
        .positive("The price must be more than zero.")
        .max(10_000_000, "That price is too high."),
      active: z.boolean(),
    }),
  )
  .min(1);

export type PriceChanges = z.input<typeof priceChangesSchema>;

export type UpdatePricesResult =
  | { ok: true; version: number }
  | { ok: false; fieldErrors: Record<string, string> };

// Saves edited tours and bumps the price list version in one transaction.
export async function updatePrices(db: Db, changes: PriceChanges): Promise<UpdatePricesResult> {
  const parsed = priceChangesSchema.safeParse(changes);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const [index, field] = issue.path;
      const slug = typeof index === "number" ? changes[index]?.slug : undefined;
      const key = slug && field ? `${slug}.${String(field)}` : "form";
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, fieldErrors };
  }

  const version = await db.transaction(async (tx) => {
    for (const change of parsed.data) {
      const updated = await tx
        .update(tours)
        .set({
          pricePerPersonBdt: change.pricePerPersonBdt,
          active: change.active,
          updatedAt: sql`now()`,
        })
        .where(eq(tours.slug, change.slug))
        .returning({ id: tours.id });
      if (updated.length === 0) throw new Error(`Unknown tour "${change.slug}".`);
    }
    const [list] = await tx
      .update(priceList)
      .set({ version: sql`${priceList.version} + 1`, updatedAt: sql`now()` })
      .returning({ version: priceList.version });
    if (!list) throw new Error("price_list is empty. Run `pnpm db:seed`.");
    return list.version;
  });
  return { ok: true, version };
}
