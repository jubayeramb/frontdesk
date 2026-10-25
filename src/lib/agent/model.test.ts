import { APICallError, generateText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { withFallback, type NamedModel } from "./model";

function failing(statusCode: number | undefined, responseBody?: string): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => {
      throw new APICallError({
        message: "boom",
        url: "https://api.groq.com/openai/v1/chat/completions",
        requestBodyValues: {},
        statusCode,
        responseBody,
      });
    },
  });
}

// Groq's 400 when the model's own output could not be parsed, as seen live on 2026-10-25.
const groqFailedGeneration = (code: string) =>
  JSON.stringify({
    error: {
      message: "Parsing failed. The model generated output that could not be parsed. Please adjust your prompt. See 'failed_generation' for more details.",
      type: "invalid_request_error",
      code,
      failed_generation: "...",
    },
  });

function answering(text: string): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

const run = (models: NamedModel[]) =>
  withFallback(models, async (model) => {
    const result = await generateText({ model, prompt: "hi", maxRetries: 0 });
    return result.text;
  });

afterEach(() => vi.restoreAllMocks());

describe("withFallback", () => {
  it.each([429, 503, undefined])("moves to the next model on %s", async (status) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await run([
      { id: "primary", model: failing(status) },
      { id: "fallback", model: answering("from fallback") },
    ]);
    expect(result).toEqual({ ok: true, value: "from fallback", modelId: "fallback" });
  });

  it.each(["output_parse_failed", "tool_use_failed"])("moves to the next model when Groq could not parse the model's output (%s)", async (code) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await run([
      { id: "primary", model: failing(400, groqFailedGeneration(code)) },
      { id: "fallback", model: answering("from fallback") },
    ]);
    expect(result).toEqual({ ok: true, value: "from fallback", modelId: "fallback" });
  });

  it("does not fall back on a 400, which is our bug", async () => {
    const fallback = answering("should not run");
    await expect(
      run([
        { id: "primary", model: failing(400) },
        { id: "fallback", model: fallback },
      ]),
    ).rejects.toThrow("boom");
    expect(fallback.doGenerateCalls).toHaveLength(0);
  });

  it("returns a failure when every model is down, logging only the error class", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await run([
      { id: "primary", model: failing(429) },
      { id: "fallback", model: failing(500) },
    ]);
    expect(result.ok).toBe(false);
    expect(warn.mock.calls.map((c) => c[0])).toEqual([
      "model primary unavailable: AI_APICallError 429",
      "model fallback unavailable: AI_APICallError 500",
    ]);
  });

  it("uses the primary model when it answers", async () => {
    const result = await run([
      { id: "primary", model: answering("from primary") },
      { id: "fallback", model: failing(500) },
    ]);
    expect(result).toMatchObject({ ok: true, modelId: "primary" });
  });
});
