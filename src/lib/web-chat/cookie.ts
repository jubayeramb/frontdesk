import { createHmac, timingSafeEqual } from "node:crypto";

export const CHAT_COOKIE = "fd_conv";
// Matches how long conversations are kept.
export const CHAT_COOKIE_MAX_AGE_S = 7 * 24 * 60 * 60;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const VALUE = new RegExp(`^(${UUID})\\.([0-9a-f]{64})$`);

// Value is "<conversationId>.<hmac>". Holding the cookie is what proves the
// conversation is yours, so the id alone is never accepted.
export function signConversationCookie(conversationId: string, secret: string): string {
  return `${conversationId}.${sign(conversationId, secret)}`;
}

// The conversation id, or null for a missing, malformed or forged value.
export function verifyConversationCookie(value: string | undefined, secret: string): string | null {
  const match = value ? VALUE.exec(value) : null;
  if (!match) return null;
  const expected = Buffer.from(sign(match[1]!, secret));
  return timingSafeEqual(Buffer.from(match[2]!), expected) ? match[1]! : null;
}

function sign(conversationId: string, secret: string): string {
  return createHmac("sha256", secret).update(`chat-conversation:${conversationId}`).digest("hex");
}
