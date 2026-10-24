"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PricedTour } from "@/lib/pricing/quote";
import { savePrices, type SavePricesState } from "./actions";

export function PricingForm({ tours }: { tours: PricedTour[] }) {
  const [state, formAction, pending] = useActionState<SavePricesState, FormData>(savePrices, {
    status: "idle",
  });
  const errors = state.status === "invalid" ? state.fieldErrors : {};
  const typed = state.status === "invalid" ? state.values : {};

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <ul className="flex flex-col divide-y rounded-lg border">
        {tours.map((tour) => {
          const priceId = `${tour.slug}-price`;
          const error = errors[`${tour.slug}.pricePerPersonBdt`];
          return (
            <li key={tour.slug} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <input type="hidden" name="slug" value={tour.slug} />
              <div className="flex flex-col gap-2 sm:flex-1">
                <Label htmlFor={priceId}>{tour.name}</Label>
                <div className="flex items-center gap-2">
                  <span aria-hidden className="text-muted-foreground">৳</span>
                  <Input
                    id={priceId}
                    name={`${tour.slug}.pricePerPersonBdt`}
                    inputMode="numeric"
                    defaultValue={typed[tour.slug] ?? tour.pricePerPersonBdt}
                    className="max-w-40"
                    aria-label={`${tour.name} price per person in taka`}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${priceId}-error` : undefined}
                  />
                  <span className="text-sm text-muted-foreground">per person</span>
                </div>
                {error ? (
                  <p id={`${priceId}-error`} role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
              </div>
              <label className="flex items-center gap-2 text-sm sm:pt-7">
                <Switch name={`${tour.slug}.active`} defaultChecked={tour.active} />
                Taking bookings
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save prices"}
        </Button>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {state.status === "saved" ? `Saved. Price list is now version ${state.version}.` : null}
          {state.status === "invalid" ? "Nothing was saved. Fix the highlighted fields." : null}
        </p>
      </div>
    </form>
  );
}
