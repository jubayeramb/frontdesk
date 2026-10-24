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
  // Shared password for /staff, and the key that signs staff session cookies.
  STAFF_PASSWORD: z.string().min(12, "Use at least 12 characters."),
  STAFF_SESSION_SECRET: z.string().min(32, "Use at least 32 characters."),
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
