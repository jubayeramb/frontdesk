// Loads the default Triplone Tours tours and prices. Run with `pnpm db:seed`.
import { parseEnv } from "@/env-schema";
import { createDb } from "./client";
import { seed } from "./seed-data";

async function main() {
  const env = parseEnv(process.env);
  const { db, pool } = createDb(env.DATABASE_URL, env.DATABASE_WS_PROXY);
  await seed(db);
  await pool.end();
  console.log("Seeded tours and price list.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
