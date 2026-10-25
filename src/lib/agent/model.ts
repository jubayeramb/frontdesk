import { createGroq } from "@ai-sdk/groq";
import { APICallError, RetryError, type LanguageModel } from "ai";

// Confirmed in the spike: both complete multi-step tool calls on Groq's free tier.
export const PRIMARY_MODEL_ID = "openai/gpt-oss-120b";
export const FALLBACK_MODEL_ID = "openai/gpt-oss-20b";

export type NamedModel = { id: string; model: LanguageModel };

export function groqModels(apiKey: string, baseURL?: string): NamedModel[] {
  const groq = createGroq({ apiKey, baseURL });
  return [PRIMARY_MODEL_ID, FALLBACK_MODEL_ID].map((id) => ({ id, model: groq(id) }));
}

export type FallbackResult<T> =
  | { ok: true; value: T; modelId: string }
  | { ok: false; error: unknown };

// Runs `fn` on each model in order, moving on only for rate limits, server
// errors and network failures. Anything else is a bug and is rethrown.
export async function withFallback<T>(
  models: NamedModel[],
  fn: (model: LanguageModel) => Promise<T>,
): Promise<FallbackResult<T>> {
  let lastError: unknown;
  for (const { id, model } of models) {
    try {
      return { ok: true, value: await fn(model), modelId: id };
    } catch (error) {
      if (!shouldFallBack(error)) throw error;
      console.warn(`model ${id} unavailable: ${describeError(error)}`);
      lastError = error;
    }
  }
  return { ok: false, error: lastError };
}

export function shouldFallBack(error: unknown): boolean {
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (!APICallError.isInstance(cause)) return false;
  const status = cause.statusCode;
  return status === undefined || status === 429 || status >= 500 || failedGeneration(cause);
}

// Groq answers 400 when the model itself wrote output it cannot parse, such as
// a malformed tool call. The request was fine, so another model may manage.
const FAILED_GENERATION_CODES = new Set(["output_parse_failed", "tool_use_failed"]);

function failedGeneration(error: APICallError): boolean {
  if (error.statusCode !== 400 || !error.responseBody) return false;
  try {
    const code = (JSON.parse(error.responseBody) as { error?: { code?: unknown } }).error?.code;
    return typeof code === "string" && FAILED_GENERATION_CODES.has(code);
  } catch {
    return false;
  }
}

// Error class and status only: never the prompt or the customer's message.
export function describeError(error: unknown): string {
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (APICallError.isInstance(cause)) return `${cause.name} ${cause.statusCode ?? "network"}`;
  return error instanceof Error ? error.name : "unknown error";
}
