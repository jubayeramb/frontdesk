import { describe, expect, it } from "vitest";

import { fixtureMessage } from "../../../../test/support/kapso-fixtures";
import { classifyInbound, kapsoMessageSchema, mapInbound } from "./inbound";

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

describe("classifyInbound", () => {
  // Sticker and location were not captured; they differ from the image only in type and content.
  const like = (type: string, extra: Record<string, unknown>) =>
    kapsoMessageSchema.parse({ ...fixtureMessage("message-received-image"), image: undefined, type, ...extra });

  it("answers text and taps", () => {
    expect(classifyInbound(message("message-received-text"))).toBe("message");
    expect(classifyInbound(message("message-received-button-reply"))).toBe("message");
    expect(classifyInbound(message("message-received-list-reply"))).toBe("message");
  });

  it("keeps long text a message, since only the model's copy is cut", () => {
    const long = { ...message("message-received-text"), text: { body: "a".repeat(5_000) } };
    expect(classifyInbound(long)).toBe("message");
  });

  it("stays silent on reactions and empty text", () => {
    expect(classifyInbound(message("message-received-reaction"))).toBe("silent");
    expect(classifyInbound({ ...message("message-received-text"), text: { body: "  " } })).toBe("silent");
  });

  it("gives media, stickers, locations and contact cards the text-only reply", () => {
    expect(classifyInbound(message("message-received-image"))).toBe("unsupported");
    expect(classifyInbound(like("sticker", { sticker: { id: "1", mime_type: "image/webp", animated: false } }))).toBe("unsupported");
    expect(classifyInbound(like("location", { location: { latitude: 23.8, longitude: 90.4 } }))).toBe("unsupported");
    for (const type of ["audio", "video", "document", "contacts", "unsupported"]) {
      expect(classifyInbound(like(type, {}))).toBe("unsupported");
    }
  });
});
