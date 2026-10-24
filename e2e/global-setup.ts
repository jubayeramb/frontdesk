import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

import { createDb } from "../src/db/client";
import { seed } from "../src/db/seed-data";
import { E2E_DATABASE_NAME, E2E_ENV } from "./env";

// Fresh, migrated and seeded database for every run.
export default async function globalSetup() {
  const admin = createDb(
    E2E_ENV.DATABASE_URL.replace(`/${E2E_DATABASE_NAME}`, "/postgres"),
    E2E_ENV.DATABASE_WS_PROXY,
  );
  try {
    await admin.db.execute(sql.raw(`drop database if exists ${E2E_DATABASE_NAME} with (force)`));
    await admin.db.execute(sql.raw(`create database ${E2E_DATABASE_NAME}`));
  } catch (error) {
    throw new Error(
      `Could not prepare the e2e database (start it with \`pnpm db:test:up\`): ${String(error)}`,
    );
  } finally {
    await admin.pool.end();
  }

  const { db, pool } = createDb(E2E_ENV.DATABASE_URL, E2E_ENV.DATABASE_WS_PROXY);
  await migrate(db, { migrationsFolder: "drizzle" });
  await seed(db);
  await pool.end();
}
