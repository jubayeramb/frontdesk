import { describe, expect, it } from "vitest";

import {
  createSessionToken,
  passwordMatches,
  SESSION_MAX_AGE_MS,
  verifySessionToken,
} from "./session";

const keys = { secret: "s".repeat(32), password: "correct-horse-battery" };
const now = new Date("2026-11-02T10:00:00Z");
const later = (ms: number) => new Date(now.getTime() + ms);

describe("staff session tokens", () => {
  it("accepts a fresh token", () => {
    const token = createSessionToken(keys, now);
    expect(verifySessionToken(token, keys, later(60_000))).toBe(true);
  });

  it("rejects a tampered token", () => {
    const token = createSessionToken(keys, now);
    const [expiresAt, sig] = token.split(".");
    const flipped = `${expiresAt}.${sig!.slice(0, -1)}${sig!.endsWith("0") ? "1" : "0"}`;
    expect(verifySessionToken(flipped, keys, now)).toBe(false);
  });

  it("rejects a token whose expiry was pushed out", () => {
    const token = createSessionToken(keys, now);
    const [, sig] = token.split(".");
    expect(verifySessionToken(`${now.getTime() + SESSION_MAX_AGE_MS + 1}.${sig}`, keys, now)).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = createSessionToken(keys, now);
    expect(verifySessionToken(token, keys, later(SESSION_MAX_AGE_MS))).toBe(false);
    expect(verifySessionToken(token, keys, later(SESSION_MAX_AGE_MS - 1))).toBe(true);
  });

  it("rejects tokens after the secret or the password rotates", () => {
    const token = createSessionToken(keys, now);
    expect(verifySessionToken(token, { ...keys, secret: "t".repeat(32) }, now)).toBe(false);
    expect(verifySessionToken(token, { ...keys, password: "new-password-here" }, now)).toBe(false);
  });

  it.each([undefined, "", "garbage", "123.abc", `${now.getTime()}.`])(
    "rejects a malformed token: %s",
    (token) => {
      expect(verifySessionToken(token, keys, now)).toBe(false);
    },
  );
});

describe("passwordMatches", () => {
  it("matches only the exact password", () => {
    expect(passwordMatches("correct-horse-battery", keys.password)).toBe(true);
    expect(passwordMatches("correct-horse-batter", keys.password)).toBe(false);
    expect(passwordMatches("", keys.password)).toBe(false);
  });
});
