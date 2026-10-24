import { describe, expect, it } from "vitest";

import { mentionsDate, stripDateLists, asksForDeparture } from "./date-lists";

describe("mentionsDate", () => {
  it("finds the date formats the model writes", () => {
    expect(mentionsDate("Which departure (28 Oct, 31 Oct) would you like?")).toBe(true);
    expect(mentionsDate("It leaves on Wednesday, 28 October 2026.")).toBe(true);
  });

  it("ignores numbers that are not dates", () => {
    expect(mentionsDate("The tour for 2 people is ৳24,000 in total.")).toBe(false);
    expect(mentionsDate("A 3-day tour from Dhaka.")).toBe(false);
  });
});

describe("asksForDeparture", () => {
  it("is true for a reply that asks the customer to pick, with or without dates", () => {
    expect(asksForDeparture("Which departure would you like to book?")).toBe(true);
    expect(asksForDeparture("Pick a date that suits you.")).toBe(true);
    expect(asksForDeparture("It leaves on Sat 31 Oct.")).toBe(true);
    expect(asksForDeparture("The total is ৳24,000 for 2 travelers.")).toBe(false);
    expect(asksForDeparture("The tour is ৳29,000 in total. Want to see departures?")).toBe(false);
  });
});

describe("stripDateLists", () => {
  it("drops the lists seen on a real phone", () => {
    expect(stripDateLists("Which of the listed departures (28 Oct, 31 Oct, 4 Nov, 7 Nov) would you like to book?")).toBe(
      "Which of the listed departures would you like to book?",
    );
    expect(stripDateLists("Which departure would you like: Wed 28 Oct, Sat 31 Oct, Wed 4 Nov, or Sat 7 Nov?")).toBe(
      "Which departure would you like?",
    );
  });

  it("keeps a date that is part of a sentence", () => {
    const text = "Your tour leaves on Wed 28 Oct. The next one is Sat 31 Oct.";
    expect(stripDateLists(text)).toBe(text);
  });
});
