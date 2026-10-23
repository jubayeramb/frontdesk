import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import { env } from "@/env";
import * as schema from "./schema";

// The WebSocket Pool (not the HTTP driver) because the webhook drain needs
// interactive transactions for FOR UPDATE SKIP LOCKED.
const pool = new Pool({ connectionString: env.DATABASE_URL });

export const db = drizzle({ client: pool, schema });
export type Db = typeof db;
