import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

import { createDb } from "@/db/client";
import { TEST_DATABASE_URL, TEST_DATABASE_WS_PROXY } from "./env";

// Rebuilds the test database from the migrations once per run.
export default async function setup() {
  const { db, pool } = createDb(TEST_DATABASE_URL, TEST_DATABASE_WS_PROXY);
  try {
    await db.execute(sql`drop schema if exists public cascade`);
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`create schema public`);
    await migrate(db, { migrationsFolder: "drizzle" });
  } catch (error) {
    const message = `Could not prepare the test database (start it with \`pnpm db:test:up\`): ${String(error)}`;
    // Vitest 5 can fail while printing a global setup error and hide it, so
    // the reason is also written out directly.
    console.error(message);
    throw new Error(message);
  } finally {
    await pool.end();
  }
}
