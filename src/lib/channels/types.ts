import type { Channel, Conversation } from "@/db/schema";
import type { AgentReply } from "@/lib/agent/replies";

// One message as a channel sends it. A reply can render into several.
export type OutboundMessage =
  | { type: "text"; text: string }
  | { type: "buttons"; body: string; buttons: { id: string; title: string }[] }
  | {
      type: "list";
      body: string;
      button: string;
      rows: { id: string; title: string; description?: string }[];
    };

export type SendResult =
  | { ok: true; externalId: string }
  | { ok: false; error: { code: string; message: string } };

export type ReplyPolicy = { canSendFreeForm: boolean; reason?: string };

export interface ChannelAdapter {
  channel: Channel;
  capabilities(): { buttons: number; listRows: number; markdown: boolean };
  // Whether a free-form reply may go out now. WhatsApp's 24-hour window lives here.
  replyPolicy(conversation: Conversation, now: Date): ReplyPolicy;
  // Pure: every degradation rule for the channel, testable without the network.
  render(reply: AgentReply): OutboundMessage[];
  // Sends one message. `nonce` is ours, so an echo of it can be told apart.
  send(to: string, message: OutboundMessage, opts: { nonce: string }): Promise<SendResult>;
}
