import "server-only";

import { db } from "@/db";
import { env } from "@/env";
import { groqModels } from "@/lib/agent/model";
import { createWhatsAppAdapter } from "@/lib/channels/whatsapp/adapter";
import { createKapsoAcknowledger, createKapsoHandler } from "./kapso-handler";

export const whatsapp = createWhatsAppAdapter({
  apiKey: env.KAPSO_API_KEY,
  phoneNumberId: env.KAPSO_PHONE_NUMBER_ID,
});

export const handleKapsoEvent = createKapsoHandler({ db, adapter: whatsapp, models: groqModels(env.GROQ_API_KEY, env.GROQ_BASE_URL) });

export const acknowledgeKapsoEvent = createKapsoAcknowledger({ adapter: whatsapp });
