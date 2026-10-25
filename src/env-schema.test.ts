import { describe, expect, it } from "vitest";

import { parseEnv } from "./env-schema";

const valid = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  GROQ_API_KEY: "gsk_test",
  KAPSO_API_KEY: "kapso_test",
  KAPSO_PHONE_NUMBER_ID: "1000000000000001",
  KAPSO_WEBHOOK_SECRET: "test-webhook-secret",
  NEXT_PUBLIC_WHATSAPP_NUMBER: "15550000000",
  STAFF_PASSWORD: "correct-horse-battery",
  STAFF_SESSION_SECRET: "a".repeat(32),
  CHAT_COOKIE_SECRET: "b".repeat(32),
};

describe("parseEnv", () => {
  it("accepts a valid environment and defaults NODE_ENV", () => {
    const env = parseEnv(valid);
    expect(env.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(env.NODE_ENV).toBe("development");
    expect(env.DATABASE_WS_PROXY).toBeUndefined();
  });

  it("names every missing or invalid variable", () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: "not a url" })).toThrow(/DATABASE_URL/);
    expect(() => parseEnv({})).toThrow(/DATABASE_URL[\s\S]*STAFF_PASSWORD[\s\S]*STAFF_SESSION_SECRET/);
  });

  it("rejects a short staff password or session secret", () => {
    expect(() => parseEnv({ ...valid, STAFF_PASSWORD: "short" })).toThrow(
      /STAFF_PASSWORD: Use at least 12 characters/,
    );
    expect(() => parseEnv({ ...valid, STAFF_SESSION_SECRET: "short" })).toThrow(
      /STAFF_SESSION_SECRET: Use at least 32 characters/,
    );
    expect(() => parseEnv({ ...valid, CHAT_COOKIE_SECRET: "short" })).toThrow(
      /CHAT_COOKIE_SECRET: Use at least 32 characters/,
    );
  });

  it("rejects a phone number instead of Kapso's phone_number_id", () => {
    expect(() => parseEnv({ ...valid, KAPSO_PHONE_NUMBER_ID: "+1 205-813-8571" })).toThrow(
      /KAPSO_PHONE_NUMBER_ID: Use the numeric phone_number_id/,
    );
  });
});
