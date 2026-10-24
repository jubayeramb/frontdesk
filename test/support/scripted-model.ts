import { MockLanguageModelV4 } from "ai/test";

export type ScriptStep =
  | { tools: { name: string; input: Record<string, unknown> }[] }
  | { text: string };

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

// A model that plays back a fixed script, one entry per generation step,
// so a turn's tool calls and final text are deterministic.
export function scriptedModel(steps: ScriptStep[]) {
  let index = 0;
  let callId = 0;
  return new MockLanguageModelV4({
    doGenerate: async () => {
      const step = steps[Math.min(index++, steps.length - 1)]!;
      if ("text" in step) {
        return {
          content: [{ type: "text", text: step.text }],
          finishReason: { unified: "stop", raw: undefined },
          usage,
          warnings: [],
        };
      }
      return {
        content: step.tools.map((t) => ({
          type: "tool-call" as const,
          toolCallId: `call-${++callId}`,
          toolName: t.name,
          input: JSON.stringify(t.input),
        })),
        finishReason: { unified: "tool-calls", raw: undefined },
        usage,
        warnings: [],
      };
    },
  });
}
