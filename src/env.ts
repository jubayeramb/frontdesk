import { parseEnv } from "./env-schema";

// Server-only environment, validated once at import time.
export const env = parseEnv(process.env);
export type { Env } from "./env-schema";
