import { describe, expect, it } from "vitest";

import type { AgentReply } from "@/lib/agent/replies";
import { webAdapter } from "./web";

const replies: AgentReply[] = [
  { kind: "text", text: "The **Sundarbans** tour is ৳14,500 per person.\n\n- 3 days\n- From Khulna" },
  {
    kind: "choices",
    prompt: "Departures for Sundarbans 3-day boat tour",
    options: Array.from({ length: 12 }, (_, i) => ({ id: `dep-${i}`, label: `A very long departure label number ${i}` })),
  },
  { kind: "handoff", text: "A person from our team will reply here." },
  { kind: "link", text: "Continue on WhatsApp.", url: "https://wa.me/1000000000000001", label: "Open WhatsApp" },
];

describe("web adapter", () => {
  it.each(replies)("passes a $kind reply through unchanged", (reply) => {
    const copy = structuredClone(reply);
    expect(webAdapter.render(reply)).toEqual([{ type: "reply", reply: copy }]);
  });

  it("sends without a channel id", async () => {
    await expect(webAdapter.send("visitor", { type: "reply", reply: replies[0]! }, { nonce: "n" })).resolves.toEqual({
      ok: true,
      externalId: null,
    });
  });
});
