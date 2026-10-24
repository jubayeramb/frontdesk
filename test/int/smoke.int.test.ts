import { sql } from "drizzle-orm";
import { expect, it } from "vitest";

import { setupTestDb } from "./db";

const db = setupTestDb();

it("talks to the test database through the Neon driver", async () => {
  const result = await db.execute<{ one: number }>(sql`select 1 as one`);
  expect(result.rows[0]?.one).toBe(1);
});
