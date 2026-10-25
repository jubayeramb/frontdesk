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
