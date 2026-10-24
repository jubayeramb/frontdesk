// Applies pending migrations from ./drizzle through the same driver the app uses.
// Run with `pnpm db:migrate`.
import { migrate } from "drizzle-orm/neon-serverless/migrator";

import { parseEnv } from "@/env-schema";
import { createDb } from "./client";

async function main() {
  const env = parseEnv(process.env);
  const { db, pool } = createDb(env.DATABASE_URL, env.DATABASE_WS_PROXY);
  await migrate(db, { migrationsFolder: "drizzle" });
  await pool.end();
  console.log("Migrations applied.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
