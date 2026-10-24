import { after } from "next/server";

import { db } from "@/db";
import { env } from "@/env";
import { receiveKapsoWebhook } from "@/lib/webhooks/receive";
import { handleKapsoEvent } from "@/lib/webhooks/runtime";

// Turns run after the response; this bounds how long they may take.
export const maxDuration = 60;

export function POST(request: Request) {
  return receiveKapsoWebhook(request, {
    db,
    secret: env.KAPSO_WEBHOOK_SECRET,
    phoneNumberId: env.KAPSO_PHONE_NUMBER_ID,
    handle: handleKapsoEvent,
    schedule: after,
  });
}
