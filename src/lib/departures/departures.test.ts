import { describe, expect, it } from "vitest";

import { listDepartures, parseDepartureId, type DepartureTour } from "./departures";

const sundarbans: DepartureTour = {
  slug: "sundarbans",
  name: "Sundarbans 3-day boat tour",
  departureWeekdays: [4, 0], // Thursday, Sunday
  active: true,
};

// Builds an instant from a Dhaka wall-clock time.
const dhaka = (iso: string) => new Date(`${iso}+06:00`);

describe("listDepartures", () => {
  it("offers the next four Thursday and Sunday departures from a Monday, in order", () => {
    // Monday 2 November 2026, 10:00 in Dhaka.
    const departures = listDepartures(sundarbans, dhaka("2026-11-02T10:00:00"));
    expect(departures.map((d) => [d.departsOn, d.label])).toEqual([
      ["2026-11-05", "Thu 5 Nov"],
      ["2026-11-08", "Sun 8 Nov"],
      ["2026-11-12", "Thu 12 Nov"],
      ["2026-11-15", "Sun 15 Nov"],
    ]);
    expect(departures[0]).toMatchObject({
      id: "sundarbans:2026-11-05",
      departsAt: dhaka("2026-11-05T07:00:00"),
    });
  });

  it("skips Thursday when asked on Wednesday afternoon (under 48 hours)", () => {
    const departures = listDepartures(sundarbans, dhaka("2026-11-04T15:00:00"));
    expect(departures[0]?.departsOn).toBe("2026-11-08");
    expect(departures.some((d) => d.departsOn === "2026-11-05")).toBe(false);
  });

  it("keeps a departure exactly 48 hours away", () => {
    const departures = listDepartures(sundarbans, dhaka("2026-11-03T07:00:00"));
    expect(departures[0]?.departsOn).toBe("2026-11-05");
  });

  it("stays within 14 days", () => {
    // Asked on a Sunday: the Sunday 14 days later is in, nothing after it.
    const departures = listDepartures(sundarbans, dhaka("2026-11-01T06:00:00"));
    expect(departures.at(-1)?.departsOn).toBe("2026-11-15");
    expect(departures).toHaveLength(4);
  });

  it("counts the 14 days from the Dhaka date, not the UTC date", () => {
    // 20:00 UTC Saturday 31 Oct is 02:00 Sunday 1 Nov in Dhaka, so the window
    // runs to Sunday 15 Nov. Counting from the UTC date would stop at the 14th.
    const departures = listDepartures(sundarbans, new Date("2026-10-31T20:00:00Z"));
    expect(departures.at(-1)?.departsOn).toBe("2026-11-15");
  });

  it("offers nothing for an inactive tour", () => {
    expect(listDepartures({ ...sundarbans, active: false }, dhaka("2026-11-02T10:00:00"))).toEqual([]);
  });
});

describe("parseDepartureId", () => {
  it("round-trips an id and rejects junk", () => {
    expect(parseDepartureId("sundarbans:2026-11-05")).toEqual({
      tourSlug: "sundarbans",
      departsOn: "2026-11-05",
    });
    expect(parseDepartureId("sundarbans")).toBeNull();
    expect(parseDepartureId("x:2026-11-5")).toBeNull();
  });
});
