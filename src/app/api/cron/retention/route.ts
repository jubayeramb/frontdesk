import { db } from "@/db";
import { env } from "@/env";
import { handleRetention } from "@/lib/retention";

// Run daily by the cron in vercel.json.
export function GET(request: Request) {
  return handleRetention(request, { db, secret: env.CRON_SECRET });
}
