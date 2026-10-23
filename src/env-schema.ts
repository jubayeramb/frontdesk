import { z } from "zod";

// Each phase adds the variables it starts using, so a missing value fails fast
// with a readable message instead of surfacing as a runtime error deep in a request.
export const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.url(),
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
