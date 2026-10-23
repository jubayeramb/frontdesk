import { describe, expect, it } from "vitest";

import { parseEnv } from "./env-schema";

describe("parseEnv", () => {
  it("accepts a valid environment and defaults NODE_ENV", () => {
    const env = parseEnv({ DATABASE_URL: "postgres://u:p@localhost:5432/db" });
    expect(env.DATABASE_URL).toBe("postgres://u:p@localhost:5432/db");
    expect(env.NODE_ENV).toBe("development");
  });

  it("names every missing or invalid variable", () => {
    expect(() => parseEnv({ DATABASE_URL: "not a url" })).toThrow(
      /DATABASE_URL/,
    );
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });
});
