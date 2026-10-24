import type { ChannelAdapter } from "./types";

// The widget renders every reply kind itself, so nothing degrades. The reply
// goes back in the chat response, so a send only marks the stored row sent.
export const webAdapter: ChannelAdapter = {
  channel: "web",
  capabilities: () => ({ buttons: Infinity, listRows: Infinity, markdown: true }),
  replyPolicy: () => ({ canSendFreeForm: true }),
  render: (reply) => [{ type: "reply", reply }],
  send: async () => ({ ok: true, externalId: null }),
};
