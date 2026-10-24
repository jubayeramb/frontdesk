import { describe, expect, it } from "vitest";

import { parseEnv } from "./env-schema";

const valid = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  STAFF_PASSWORD: "correct-horse-battery",
  STAFF_SESSION_SECRET: "a".repeat(32),
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
  });
});
