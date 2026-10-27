import { DEFAULT_TOURS } from "../src/db/seed-data";
import { listDepartures } from "../src/lib/departures/departures";

// How many departures the app offers today for a seeded tour. It moves with
// the date (3 or 4 for a twice-weekly tour), so tests ask instead of assuming.
export function departureCount(slug: string): number {
  const tour = DEFAULT_TOURS.find((t) => t.slug === slug)!;
  return listDepartures({ ...tour, active: true }, new Date()).length;
}
