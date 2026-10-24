import { describe, expect, it } from "vitest";

import { firstMessage } from "./first-message";

describe("firstMessage", () => {
  it("keeps a normal reply whole", () => {
    const text = "Your booking is confirmed! Reference TR-00001, departing Thu 29 Oct. Total ৳29,000.";
    expect(firstMessage(text)).toBe(text);
  });

  it("cuts the run-on messages seen on a real phone", () => {
    const text =
      "Here are the upcoming departures for the Sundarbans tour: Thu 29 Oct, Sun 1 Nov, Thu 5 Nov. Which date works best for you?Let me know which departure you’d like to book.Whenever you’re ready, just tell me the date you prefer.";
    expect(firstMessage(text)).toBe(
      "Here are the upcoming departures for the Sundarbans tour: Thu 29 Oct, Sun 1 Nov, Thu 5 Nov. Which date works best for you?",
    );
  });

  it("cuts after an exclamation or a full stop too", () => {
    expect(firstMessage("Pick a date below.Sure! Let me know.")).toBe("Pick a date below.");
    expect(firstMessage("Great choice!Whenever you are ready.")).toBe("Great choice!");
  });

  it("leaves amounts, times and lowercase text alone", () => {
    expect(firstMessage("That is ৳14,500.50 per person, leaving at 7.00 am.")).toBe("That is ৳14,500.50 per person, leaving at 7.00 am.");
  });
});
