import { describe, expect, it } from "vitest";

import { dropListedOptions, dropOptionIds } from "./listed-options";

const departures = [
  { id: "sylhet:2026-10-30", label: "Fri 30 Oct" },
  { id: "sylhet:2026-11-06", label: "Fri 6 Nov" },
];

describe("dropListedOptions", () => {
  it("drops the options the model listed, as seen in a live run", () => {
    expect(dropListedOptions("These are the next departures for the Sylhet tour:  \n- Fri 30 Oct  \n- Fri 6 Nov", departures)).toBe(
      "These are the next departures for the Sylhet tour.",
    );
  });

  it("drops numbered and bold items too, and keeps the rest of the reply", () => {
    expect(dropListedOptions("Pick one:\n1. **Fri 30 Oct**\n2) Fri 6 Nov\n\nBoth leave at 7 am.", departures)).toBe(
      "Pick one:\n\nBoth leave at 7 am.",
    );
  });

  it("matches labels whatever the dash or case", () => {
    const tours = [{ id: "sundarbans", label: "Sundarbans 3-day boat tour" }];
    expect(dropListedOptions("Here are our tours:\n- sundarbans 3‑day boat tour", tours)).toBe("Here are our tours.");
  });

  it("drops list lines that carry an option id, as seen in a live run", () => {
    expect(
      dropListedOptions(
        "Here are the upcoming departures for the Sylhet tea gardens 2‑day tour:\n- Fri 30 Oct (id: sylhet:2026-10-30)\n- Fri 6 Nov (id: sylhet:2026-11-06)",
        departures,
      ),
    ).toBe("Here are the upcoming departures for the Sylhet tea gardens 2‑day tour.");
  });

  it("leaves a reply alone when its list is not the options", () => {
    const text = "The tour includes:\n- Boat stay\n- Forest walks";
    expect(dropListedOptions(text, departures)).toBe(text);
    expect(dropListedOptions("Here are the next departures.", departures)).toBe("Here are the next departures.");
  });
});

describe("dropOptionIds", () => {
  it("removes ids the model copied from its history", () => {
    expect(dropOptionIds("Booked Fri 30 Oct (id: sylhet:2026-10-30) for 2.")).toBe("Booked Fri 30 Oct for 2.");
    expect(dropOptionIds("You picked Sun 8 Nov (picked option id: sundarbans:2026-11-08).")).toBe("You picked Sun 8 Nov.");
    expect(dropOptionIds("The tour (3 days) leaves Friday.")).toBe("The tour (3 days) leaves Friday.");
  });

  it("writes a bare departure id as its date, as seen in a live run", () => {
    expect(dropOptionIds("Please let me know which departure you'd like (e.g., **sundarbans:2026-10-29**).")).toBe(
      "Please let me know which departure you'd like (e.g., **Thu 29 Oct**).",
    );
    expect(dropOptionIds("Meet at 7:00 on 2026-10-29.")).toBe("Meet at 7:00 on 2026-10-29.");
  });
});
