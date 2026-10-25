import type { Metadata } from "next";
import { Suspense } from "react";

import { db } from "@/db";
import { getPriceList } from "@/lib/pricing/price-list";
import { requireStaff } from "@/lib/staff/auth";
import { PricingForm } from "./pricing-form";

export const metadata: Metadata = { title: "Pricing | Triplone Tours staff" };

export default function PricingPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pricing</h1>
        <p className="text-sm text-muted-foreground">The agent quotes these prices.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading prices...</p>}>
        <PriceListSection />
      </Suspense>
    </div>
  );
}

async function PriceListSection() {
  await requireStaff("/staff/pricing");
  const priceList = await getPriceList(db);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Price list version <span data-testid="price-list-version">{priceList.version}</span>
      </p>
      <PricingForm tours={priceList.tours} />
    </div>
  );
}
