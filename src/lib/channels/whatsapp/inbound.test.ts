import { describe, expect, it } from "vitest";

import { fixtureMessage } from "../../../../test/support/kapso-fixtures";
import { kapsoMessageSchema, mapInbound } from "./inbound";

const message = (name: string) => kapsoMessageSchema.parse(fixtureMessage(name));

const twelve = Array.from({ length: 12 }, (_, i) => ({ id: `sundarbans:2026-11-${i + 1}`, label: `Departure ${i + 1}` }));

describe("mapInbound", () => {
  it("reads free text", () => {
    expect(mapInbound(message("message-received-text"), null)).toEqual({ text: "Hello" });
  });

  it("reads a button tap as its option id", () => {
    expect(mapInbound(message("message-received-button-reply"), null)).toEqual({
      text: "Standard clean",
      choiceId: "svc_standard",
    });
  });

  it("reads a list tap as its option id, with the full label when it was offered", () => {
    const offered = [{ id: "slot_2026-10-28T18:00:00Z", label: "Wednesday 28 October, 1:00 PM" }];
    expect(mapInbound(message("message-received-list-reply"), offered)).toEqual({
      text: "Wednesday 28 October, 1:00 PM",
      choiceId: "slot_2026-10-28T18:00:00Z",
    });
  });

  it("reads a number against the last numbered choices", () => {
    const seven = { ...message("message-received-text"), text: { body: " 7 " } };
    expect(mapInbound(seven, twelve)).toEqual({ text: "Departure 7", choiceId: "sundarbans:2026-11-7" });
  });

  it("keeps a number as text when it is out of range or the choices were not numbered", () => {
    const thirteen = { ...message("message-received-text"), text: { body: "13" } };
    expect(mapInbound(thirteen, twelve)).toEqual({ text: "13" });
    const two = { ...message("message-received-text"), text: { body: "2" } };
    expect(mapInbound(two, twelve.slice(0, 4))).toEqual({ text: "2" });
  });

  it("skips images and reactions", () => {
    expect(mapInbound(message("message-received-image"), null)).toBeNull();
    expect(mapInbound(message("message-received-reaction"), null)).toBeNull();
  });
});
