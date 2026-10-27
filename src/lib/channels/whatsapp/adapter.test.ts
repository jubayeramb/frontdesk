import { describe, expect, it, vi } from "vitest";

import { fakeKapso } from "../../../../test/support/fake-kapso";
import { createWhatsAppAdapter } from "./adapter";

const PHONE_NUMBER_ID = "1382322134966757";

describe("WhatsApp adapter typing indicator", () => {
  it("marks the message read with a text typing indicator", async () => {
    const kapso = fakeKapso();
    const fetchSpy = vi.fn(kapso.fetch);
    const adapter = createWhatsAppAdapter({ apiKey: "k", phoneNumberId: PHONE_NUMBER_ID, fetch: fetchSpy as typeof fetch });

    await adapter.markRead!("wamid.inbound-1", { typing: true });
    await adapter.markRead!("wamid.inbound-2", { typing: false });

    expect(kapso.receipts).toEqual([
      { messaging_product: "whatsapp", status: "read", message_id: "wamid.inbound-1", typing_indicator: { type: "text" } },
      { messaging_product: "whatsapp", status: "read", message_id: "wamid.inbound-2" },
    ]);
    expect(String(fetchSpy.mock.calls[0]![0])).toContain(`/${PHONE_NUMBER_ID}/messages`);
    expect(kapso.sends).toEqual([]);
  });

  it("resolves and logs only the error code when Kapso rejects it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const kapso = fakeKapso();
    kapso.failReceipts(400, { error: { message: "Invalid message id", type: "OAuthException", code: 100 } });
    const adapter = createWhatsAppAdapter({ apiKey: "k", phoneNumberId: PHONE_NUMBER_ID, fetch: kapso.fetch });

    await expect(adapter.markRead!("wamid.gone", { typing: true })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith("whatsapp read receipt failed: 100");
    warn.mockRestore();
  });
});

describe("WhatsApp adapter addressing", () => {
  const text = { type: "text" as const, text: "Hello" };

  it("sends to a phone number with `to`", async () => {
    const kapso = fakeKapso();
    const adapter = createWhatsAppAdapter({ apiKey: "k", phoneNumberId: PHONE_NUMBER_ID, fetch: kapso.fetch });

    await adapter.send("8801700000000", text, { nonce: "n1" });

    expect(kapso.sends[0]).toMatchObject({ to: "8801700000000", type: "text" });
    expect(kapso.sends[0]).not.toHaveProperty("recipient");
  });

  it("sends to a business-scoped user id with `recipient`", async () => {
    const kapso = fakeKapso();
    const adapter = createWhatsAppAdapter({ apiKey: "k", phoneNumberId: PHONE_NUMBER_ID, fetch: kapso.fetch });

    const result = await adapter.send("BD.1000000000000002", text, { nonce: "n1" });

    expect(result).toEqual({ ok: true, externalId: "wamid.fake-1" });
    expect(kapso.sends[0]).toMatchObject({ recipient: "BD.1000000000000002", type: "text" });
    expect(kapso.sends[0]).not.toHaveProperty("to");
  });
});
