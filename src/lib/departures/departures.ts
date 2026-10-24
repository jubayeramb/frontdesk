import type { Tour } from "@/db/schema";

// Bangladesh has no daylight saving, so Dhaka is always UTC+6.
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const DEPARTURE_HOUR = 7; // Every tour leaves at 07:00 Dhaka time.
export const WINDOW_DAYS = 14;
export const MIN_NOTICE_MS = 48 * 60 * 60 * 1000;

export type DepartureTour = Pick<Tour, "slug" | "name" | "departureWeekdays" | "active">;

export type Departure = {
  id: string; // "<tour-slug>:<YYYY-MM-DD>", round-trips through button ids.
  tourSlug: string;
  departsOn: string; // Dhaka calendar date, YYYY-MM-DD.
  departsAt: Date;
  label: string; // "Thu 6 Nov"
};

const labelFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  weekday: "short",
  day: "numeric",
  month: "short",
});

// Departures in the next 14 Dhaka calendar days, skipping any within 48 hours.
export function listDepartures(tour: DepartureTour, now: Date): Departure[] {
  if (!tour.active) return [];
  const todayStartUtc = dhakaMidnightUtc(now);
  const departures: Departure[] = [];
  for (let day = 1; day <= WINDOW_DAYS; day++) {
    const midnight = todayStartUtc + day * DAY_MS;
    const weekday = new Date(midnight + DHAKA_OFFSET_MS).getUTCDay();
    if (!tour.departureWeekdays.includes(weekday)) continue;
    const departsAt = new Date(midnight + DEPARTURE_HOUR * 60 * 60 * 1000);
    if (departsAt.getTime() - now.getTime() < MIN_NOTICE_MS) continue;
    const departsOn = new Date(midnight + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
    departures.push({
      id: departureId(tour.slug, departsOn),
      tourSlug: tour.slug,
      departsOn,
      departsAt,
      label: labelFormat.format(departsAt).replace(",", ""),
    });
  }
  return departures;
}

export function departureId(tourSlug: string, departsOn: string): string {
  return `${tourSlug}:${departsOn}`;
}

export function parseDepartureId(id: string): { tourSlug: string; departsOn: string } | null {
  const match = /^([a-z0-9-]+):(\d{4}-\d{2}-\d{2})$/.exec(id);
  return match ? { tourSlug: match[1]!, departsOn: match[2]! } : null;
}

// UTC instant of 00:00 Dhaka time on the Dhaka calendar day containing `now`.
function dhakaMidnightUtc(now: Date): number {
  const local = now.getTime() + DHAKA_OFFSET_MS;
  return local - (local % DAY_MS) - DHAKA_OFFSET_MS;
}
