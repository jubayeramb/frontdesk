"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { updatePrices, type PriceChanges } from "@/lib/pricing/price-list";
import { requireStaff } from "@/lib/staff/auth";

export type SavePricesState =
  | { status: "idle" }
  | { status: "saved"; version: number }
  // `values` holds what was typed, so the fields keep it after React resets the form.
  | { status: "invalid"; fieldErrors: Record<string, string>; values: Record<string, string> };

export async function savePrices(
  _prev: SavePricesState,
  formData: FormData,
): Promise<SavePricesState> {
  await requireStaff("/staff/pricing");

  const slugs = formData.getAll("slug").filter((s): s is string => typeof s === "string");
  const changes: PriceChanges = slugs.map((slug) => ({
    slug,
    pricePerPersonBdt: String(formData.get(`${slug}.pricePerPersonBdt`) ?? ""),
    active: formData.get(`${slug}.active`) === "on",
  }));

  const result = await updatePrices(db, changes);
  if (!result.ok) {
    const values = Object.fromEntries(changes.map((c) => [c.slug, String(c.pricePerPersonBdt)]));
    return { status: "invalid", fieldErrors: result.fieldErrors, values };
  }
  revalidatePath("/staff/pricing");
  return { status: "saved", version: result.version };
}
