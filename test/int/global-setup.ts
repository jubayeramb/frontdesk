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
    throw new Error(
      `Could not prepare the test database (start it with \`pnpm db:test:up\`): ${String(error)}`,
    );
  } finally {
    await pool.end();
  }
}
