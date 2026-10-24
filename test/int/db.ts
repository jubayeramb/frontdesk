import { sql } from "drizzle-orm";
import { afterAll, beforeEach } from "vitest";

import { createDb } from "@/db/client";
import { TEST_DATABASE_URL, TEST_DATABASE_WS_PROXY } from "./env";

// One pool per test file; every table is emptied before each test.
export function setupTestDb() {
  const { db, pool } = createDb(TEST_DATABASE_URL, TEST_DATABASE_WS_PROXY);

  beforeEach(async () => {
    const { rows } = await pool.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public'",
    );
    if (rows.length > 0) {
      const tables = rows.map((r) => `"${r.tablename}"`).join(", ");
      await db.execute(sql.raw(`truncate ${tables} restart identity cascade`));
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  return db;
}
