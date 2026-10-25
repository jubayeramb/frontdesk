import { after } from "next/server";

import { db } from "@/db";
import { env } from "@/env";
import { groqModels } from "@/lib/agent/model";
import { getChat, postChat } from "@/lib/web-chat/handler";
import { handleKapsoEvent, limits } from "@/lib/webhooks/runtime";

// A turn runs inside the request; this bounds how long it may take.
export const maxDuration = 60;

const models = groqModels(env.GROQ_API_KEY, env.GROQ_BASE_URL);

export function POST(request: Request) {
  return postChat(request, {
    db,
    secret: env.CHAT_COOKIE_SECRET,
    models,
    whatsappNumber: env.NEXT_PUBLIC_WHATSAPP_NUMBER,
    limits,
    handleWebhookEvent: handleKapsoEvent,
    schedule: after,
  });
}

export function GET(request: Request) {
  return getChat(request, { db, secret: env.CHAT_COOKIE_SECRET });
}
