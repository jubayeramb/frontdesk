import { GraphApiError, WhatsAppClient } from "@kapso/whatsapp-cloud-api";

import type { ChannelAdapter, OutboundMessage, SendResult } from "../types";
import { LIMITS, render } from "./render";

export const KAPSO_PROXY_URL = "https://api.kapso.ai/meta/whatsapp";

// The only place that calls Kapso's send API.
export function createWhatsAppAdapter(config: {
  apiKey: string;
  phoneNumberId: string;
  // Tests swap the network out here.
  fetch?: typeof fetch;
}): ChannelAdapter {
  const client = new WhatsAppClient({ baseUrl: KAPSO_PROXY_URL, kapsoApiKey: config.apiKey, fetch: config.fetch });
  const phoneNumberId = config.phoneNumberId;

  async function sendOne(to: string, message: OutboundMessage, nonce: string) {
    // Echoed back on status webhooks, so our sends can be matched by nonce too.
    const common = { phoneNumberId, to, bizOpaqueCallbackData: nonce };
    switch (message.type) {
      case "text":
        return client.messages.sendText({ ...common, body: message.text });
      case "buttons":
        return client.messages.sendInteractiveButtons({ ...common, bodyText: message.body, buttons: message.buttons });
      case "list":
        return client.messages.sendInteractiveList({
          ...common,
          bodyText: message.body,
          buttonText: message.button,
          sections: [{ rows: message.rows }],
        });
      case "reply":
        throw new Error("WhatsApp sends rendered messages, never raw replies");
    }
  }

  return {
    channel: "whatsapp",
    capabilities: () => ({ buttons: LIMITS.buttons, listRows: LIMITS.listRows, markdown: false }),
    // add-guards-and-retention adds the 24-hour window.
    replyPolicy: () => ({ canSendFreeForm: true }),
    render,
    async send(to, message, { nonce }): Promise<SendResult> {
      try {
        const response = await sendOne(to, message, nonce);
        const externalId = response.messages[0]?.id;
        if (!externalId) return { ok: false, error: { code: "no_message_id", message: "Kapso returned no message id" } };
        return { ok: true, externalId };
      } catch (error) {
        return { ok: false, error: sendError(error) };
      }
    },
    // With `typing`, WhatsApp shows "typing…" until our reply, for up to 25 seconds.
    async markRead(inboundExternalId, { typing }) {
      try {
        await client.messages.markRead({
          phoneNumberId,
          messageId: inboundExternalId,
          ...(typing && { typingIndicator: { type: "text" as const } }),
        });
      } catch (error) {
        console.warn(`whatsapp read receipt failed: ${sendError(error).code}`);
      }
    },
  };
}

function sendError(error: unknown): { code: string; message: string } {
  if (error instanceof GraphApiError) {
    return { code: String(error.apiCode ?? error.code), message: error.message };
  }
  return { code: error instanceof Error ? error.name : "unknown", message: String(error) };
}
