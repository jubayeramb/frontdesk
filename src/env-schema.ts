import { z } from "zod";

// Each phase adds the variables it starts using, so a missing value fails fast
// with a readable message instead of surfacing as a runtime error deep in a request.
export const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.url(),
  // Set only for a local Postgres behind Neon's wsproxy, e.g. "localhost:5433/v1".
  DATABASE_WS_PROXY: z.string().min(1).optional(),
  GROQ_API_KEY: z.string().min(1),
  // Only the end-to-end tests set this, to point the agent at a scripted fake.
  GROQ_BASE_URL: z.url().optional(),
  // Kapso sends WhatsApp messages for this number and signs its webhooks.
  KAPSO_API_KEY: z.string().min(1),
  KAPSO_PHONE_NUMBER_ID: z.string().regex(/^\d+$/, "Use the numeric phone_number_id from Kapso."),
  KAPSO_WEBHOOK_SECRET: z.string().min(1),
  // The demo WhatsApp number, digits only. Web visitors who ask for a person are sent there.
  NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().regex(/^\d{8,15}$/, "Use the number in international format, digits only."),
  // Kapso's inbox for /staff (`pnpm inbox:embed`). It carries a token, so it is
  // only ever rendered behind the staff session. Unset, /staff says how to add it.
  KAPSO_INBOX_EMBED_URL: z.url().startsWith("https://").optional(),
  // Shared password for /staff, and the key that signs staff session cookies.
  STAFF_PASSWORD: z.string().min(12, "Use at least 12 characters."),
  STAFF_SESSION_SECRET: z.string().min(32, "Use at least 32 characters."),
  // Signs the web chat cookie that ties a visitor to their conversation.
  CHAT_COOKIE_SECRET: z.string().min(32, "Use at least 32 characters."),
});

export type Env = z.infer<typeof serverSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = serverSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}
