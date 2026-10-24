import { describe, expect, it } from "vitest";

import type { ChoiceOption } from "@/lib/agent/replies";
import { LIMITS, render, shorten, splitText, stripMarkdown } from "./render";

const options = (n: number): ChoiceOption[] =>
  Array.from({ length: n }, (_, i) => ({ id: `sundarbans:2026-11-${String(i + 1).padStart(2, "0")}`, label: `Thu ${i + 1} Nov` }));

describe("choices", () => {
  it("sends 3 options as one message with 3 reply buttons", () => {
    const sent = render({ kind: "choices", prompt: "Which tour would you like?", options: options(3) });
    expect(sent).toEqual([
      {
        type: "buttons",
        body: "Which tour would you like?",
        buttons: [
          { id: "sundarbans:2026-11-01", title: "Thu 1 Nov" },
          { id: "sundarbans:2026-11-02", title: "Thu 2 Nov" },
          { id: "sundarbans:2026-11-03", title: "Thu 3 Nov" },
        ],
      },
    ]);
  });

  it("sends 10 options as one list with 10 rows", () => {
    const sent = render({ kind: "choices", prompt: "Departures", options: options(10) });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: "list", body: "Departures", button: "Choose" });
    expect(sent[0]!.type === "list" && sent[0]!.rows.map((r) => r.id)).toEqual(options(10).map((o) => o.id));
  });

  it("sends 12 options as numbered text ending with the reply range", () => {
    const sent = render({ kind: "choices", prompt: "Departures", options: options(12) });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({
      type: "text",
      text: expect.stringMatching(/^Departures\n\n1\. Thu 1 Nov\n2\. Thu 2 Nov\n[\s\S]*\n12\. Thu 12 Nov\n\nReply 1-12$/),
    });
  });

  it("keeps the tour and the date in a long list row, with the full label below", () => {
    const label = "Sundarbans 3-day, Thursday 6 November";
    const [list] = render({
      kind: "choices",
      prompt: "Departures",
      options: [...options(3), { id: "sundarbans:2026-11-06", label }],
    });
    const row = list!.type === "list" ? list!.rows[3]! : undefined;
    expect(row!.title.length).toBeLessThanOrEqual(LIMITS.rowTitle);
    expect(row!.title).toBe("Sundarbans…, Thu 6 Nov");
    expect(row!.description).toBe(label);
  });

  it("sends options that do not fit a button as a list that keeps the full labels", () => {
    const [list] = render({
      kind: "choices",
      prompt: "Which tour would you like?",
      label: "View tours",
      options: [
        { id: "sundarbans", label: "Sundarbans 3-day boat tour" },
        { id: "sylhet", label: "Sylhet tea gardens 2-day" },
        { id: "bandarban", label: "Bandarban hills 3-day" },
      ],
    });
    expect(list).toEqual({
      type: "list",
      body: "Which tour would you like?",
      button: "View tours",
      rows: [
        { id: "sundarbans", title: "Sundarbans 3-day boat…", description: "Sundarbans 3-day boat tour" },
        { id: "sylhet", title: "Sylhet tea gardens 2-day" },
        { id: "bandarban", title: "Bandarban hills 3-day" },
      ],
    });
  });
});

it("opens a list from its own label, cut to fit, or Choose for older replies", () => {
  const options = Array.from({ length: 4 }, (_, i) => ({ id: `d${i}`, label: `Day ${i}` }));
  const [dated] = render({ kind: "choices", prompt: "Departures", label: "View dates", options });
  const [long] = render({ kind: "choices", prompt: "Departures", label: "View every departure this month", options });
  const [old] = render({ kind: "choices", prompt: "Departures", options });
  expect([dated, long, old].map((m) => (m as { button: string }).button)).toEqual(["View dates", "View every…", "Choose"]);
});

describe("text", () => {
  it("strips bold, headings and code, and turns links into plain URLs", () => {
    expect(stripMarkdown("Your total is **৳58,000**")).toBe("Your total is ৳58,000");
    expect(stripMarkdown("## Tours\n__Sylhet__ is `2 days`")).toBe("Tours\nSylhet is 2 days");
    expect(stripMarkdown("[Pay here](https://pay.example/1) or [https://x.example](https://x.example)")).toBe(
      "Pay here: https://pay.example/1 or https://x.example",
    );
  });

  it("splits a long text into messages that each fit, at line breaks", () => {
    const paragraph = "Day one on the boat. ".repeat(60).trim();
    const text = Array.from({ length: 6 }, () => paragraph).join("\n\n");
    const sent = render({ kind: "text", text });
    expect(sent.length).toBeGreaterThan(1);
    for (const message of sent) {
      expect(message.type === "text" && message.text.length).toBeLessThanOrEqual(LIMITS.textBody);
    }
    expect(sent.map((m) => (m.type === "text" ? m.text : "")).join("\n\n")).toBe(text);
  });

  it("sends a link reply as text with a plain URL", () => {
    expect(render({ kind: "link", text: "Talk to us on WhatsApp:", url: "https://wa.me/12058138571", label: "Open" })).toEqual([
      { type: "text", text: "Talk to us on WhatsApp:\nhttps://wa.me/12058138571" },
    ]);
  });
});

describe("shorten", () => {
  it("leaves short labels and shortens day and month names first", () => {
    expect(shorten("Thu 29 Oct", 20)).toBe("Thu 29 Oct");
    expect(shorten("Sylhet, Wednesday 4 November", 24)).toBe("Sylhet, Wed 4 Nov");
  });

  it("splits a word with no spaces anywhere", () => {
    expect(splitText("a".repeat(10), 4)).toEqual(["aaaa", "aaaa", "aa"]);
  });
});
