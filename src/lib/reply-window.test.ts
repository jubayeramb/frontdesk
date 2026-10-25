import { describe, expect, it } from "vitest";

import { describeWindow, windowRemaining } from "./reply-window";

const last = new Date("2026-11-02T10:00:00Z");
const after = (h: number, m: number) => new Date(last.getTime() + (h * 60 + m) * 60_000);

describe("windowRemaining", () => {
  it("is open at 23h59m, and closed at 24h00m and after", () => {
    expect(windowRemaining(last, after(23, 59))).toBe(60_000);
    expect(windowRemaining(last, after(24, 0))).toBe(0);
    expect(windowRemaining(last, after(24, 1))).toBe(0);
  });

  it("is closed when the customer never wrote", () => {
    expect(windowRemaining(null, last)).toBe(0);
  });
});

describe("describeWindow", () => {
  it("shows hours and minutes left, rounding up to the minute", () => {
    expect(describeWindow(windowRemaining(last, after(21, 0)))).toBe("3h left");
    expect(describeWindow(windowRemaining(last, after(20, 47)))).toBe("3h 13m left");
    expect(describeWindow(30_000)).toBe("1m left");
    expect(describeWindow(45 * 60_000)).toBe("45m left");
  });

  it("says the window closed", () => {
    expect(describeWindow(0)).toBe("Window closed");
  });
});
