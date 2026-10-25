import "server-only";

import { db } from "@/db";
import { env } from "@/env";
import { groqModels } from "@/lib/agent/model";
import { createWhatsAppAdapter } from "@/lib/channels/whatsapp/adapter";
import { DEFAULT_LIMITS, type Limits } from "@/lib/guards";
import { createKapsoAcknowledger, createKapsoHandler } from "./kapso-handler";

export const whatsapp = createWhatsAppAdapter({
  apiKey: env.KAPSO_API_KEY,
  phoneNumberId: env.KAPSO_PHONE_NUMBER_ID,
});

export const limits: Limits = { ...DEFAULT_LIMITS, globalPerDay: env.GLOBAL_DAILY_TURN_CAP };

export const handleKapsoEvent = createKapsoHandler({
  db,
  adapter: whatsapp,
  models: groqModels(env.GROQ_API_KEY, env.GROQ_BASE_URL),
  limits,
});

export const acknowledgeKapsoEvent = createKapsoAcknowledger({ db, adapter: whatsapp });
