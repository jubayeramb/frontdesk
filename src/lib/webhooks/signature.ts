import { createHmac, timingSafeEqual } from "node:crypto";

// Kapso signs the raw body: X-Webhook-Signature is HMAC-SHA256(secret, body)
// as 64 lowercase hex characters.
export function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
