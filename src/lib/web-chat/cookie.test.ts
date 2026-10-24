import { describe, expect, it } from "vitest";

import { signConversationCookie, verifyConversationCookie } from "./cookie";

const secret = "s".repeat(32);
const id = "5b0b8f8e-6a43-4a43-9c1e-2f0d9f7e8a11";

describe("conversation cookie", () => {
  it("round-trips a signed conversation id", () => {
    expect(verifyConversationCookie(signConversationCookie(id, secret), secret)).toBe(id);
  });

  it("rejects a missing or malformed value", () => {
    expect(verifyConversationCookie(undefined, secret)).toBeNull();
    expect(verifyConversationCookie("", secret)).toBeNull();
    expect(verifyConversationCookie(id, secret)).toBeNull();
    expect(verifyConversationCookie(`${id}.not-hex`, secret)).toBeNull();
  });

  it("rejects a tampered id, a tampered signature and another secret", () => {
    const value = signConversationCookie(id, secret);
    const signature = value.split(".")[1]!;
    const otherId = "00000000-0000-4000-8000-000000000000";
    expect(verifyConversationCookie(`${otherId}.${signature}`, secret)).toBeNull();
    expect(verifyConversationCookie(`${id}.${"0".repeat(64)}`, secret)).toBeNull();
    expect(verifyConversationCookie(value, "t".repeat(32))).toBeNull();
  });
});
