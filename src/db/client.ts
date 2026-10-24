import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "./schema";

// The WebSocket Pool (not the HTTP driver) because the webhook drain needs
// interactive transactions for FOR UPDATE SKIP LOCKED.
export function createDb(connectionString: string, wsProxy?: string) {
  if (wsProxy) {
    // Local Postgres behind Neon's wsproxy speaks plain ws, without Neon's
    // pipelining shortcuts.
    neonConfig.wsProxy = () => wsProxy;
    neonConfig.useSecureWebSocket = false;
    neonConfig.pipelineTLS = false;
    neonConfig.pipelineConnect = false;
  }
  const pool = new Pool({ connectionString });
  return { db: drizzle({ client: pool, schema }), pool };
}

export type Db = ReturnType<typeof createDb>["db"];
