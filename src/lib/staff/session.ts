import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "fd_staff";
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type Keys = { secret: string; password: string };

// Token is "<expiresAtMs>.<hmac>". The key mixes in the password, so rotating
// either the session secret or the password ends every session.
export function createSessionToken(keys: Keys, now: Date): string {
  const expiresAt = now.getTime() + SESSION_MAX_AGE_MS;
  return `${expiresAt}.${sign(keys, expiresAt)}`;
}

export function verifySessionToken(token: string | undefined, keys: Keys, now: Date): boolean {
  if (!token) return false;
  const match = /^(\d{13})\.([0-9a-f]{64})$/.exec(token);
  if (!match) return false;
  const expiresAt = Number(match[1]);
  if (expiresAt <= now.getTime()) return false;
  // A token claiming to last longer than a session can was not made here.
  if (expiresAt - now.getTime() > SESSION_MAX_AGE_MS) return false;
  return safeEqual(match[2]!, sign(keys, expiresAt));
}

// Compares hashes so neither the length nor the content leaks through timing.
export function passwordMatches(attempt: string, password: string): boolean {
  return timingSafeEqual(sha256(attempt), sha256(password));
}

function sign({ secret, password }: Keys, expiresAt: number): string {
  return createHmac("sha256", `${secret}\0${password}`)
    .update(`staff-session:${expiresAt}`)
    .digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}
