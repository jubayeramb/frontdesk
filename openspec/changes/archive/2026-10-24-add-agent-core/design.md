# Design

## Context

Pricing and departure logic exist as pure functions plus database loaders (add-pricing-and-booking-data).
The spike confirmed the models: primary `openai/gpt-oss-120b`, fallback `openai/gpt-oss-20b` (same family and prompt format; `qwen/qwen3.8-27b` also passed). Limits are 1,000 requests a day and 8,000 tokens a minute per model, and a 3-step turn costs about 1.4K tokens.
The AI SDK major version on npm today is 7.
Read its docs for `generateText`, tools and stop conditions before writing code, since APIs moved between majors.

## Goals / Non-Goals

**Goals:**
- `runTurn` has no import from `src/lib/channels` and no Kapso or HTTP code.
- Every behavior in the specs is testable with the AI SDK mock model and a real database.

**Non-Goals:**
- Streaming.
  Replies are short, and WhatsApp cannot stream anyway.
- Long-term memory beyond the state summary.

## Decisions

### Turn shape

```ts
type AgentReply =
  | { kind: "text"; text: string }
  | { kind: "choices"; prompt: string; options: { id: string; label: string }[] }
  | { kind: "handoff"; text: string }
  | { kind: "link"; text: string; url: string; label: string };

runTurn({ conversationId, inbound, channel, now }): Promise<AgentReply[]>
```

`channel` only selects a one-line hint in the prompt ("Replies show on WhatsApp; keep them short, no markdown").
`now` is injected so departure tests are deterministic.

### Presenter, not model-written options

Tools that return options (`listTours`, `listDepartures`) also push a `choices` reply into a per-turn collector.
The model's final text becomes a `text` reply placed before the collected `choices`.
The model can introduce the options in words, but it never writes the option list itself.

Alternative: ask the model to output structured `choices` JSON. It works most of the time, and "most of the time" is the problem: an invented departure is a false promise.

### Grounded prices

`getQuote` takes the customer's raw inputs (tour and number of travelers) and does every calculation in code.
In the spike, the primary model once pre-adjusted an input that the tool adjusted again, producing a wrong total; tools that accept derived values invite that mistake, and the amount guard cannot catch it because the wrong number comes from a tool.
It returns the per-person price, travelers and total formatted by code (`৳58,000`), and writes the quote to `conversations.state`.
The prompt says to quote only tool output.
A post-check scans the final text for currency amounts and drops the reply if any amount is not in this turn's tool results or the stored quote, replacing it with the quote text built from the tool result.
This guard is what makes the pricing spec hold even when the model misbehaves.

### Model module

`src/lib/agent/model.ts` exports the ordered model list and `withFallback(models, fn)`.
It retries once on the next model for HTTP 429 and 5xx, never on 4xx validation errors.
A step limit of 5 keeps one turn from burning the per-minute token budget.

### History window

Load the last 20 messages for the conversation (all channels), map them to model messages, and prepend a system message with the state summary (latest quote and booking).
Choice selections are stored as the option label, with the id in the payload, so history reads naturally.

### Persistence

`runTurn` stores the inbound message and the replies in one place (`src/lib/conversations/`), so channels never write messages directly.
The adapter later fills in each outbound message's external id.

## Risks / Trade-offs

- [Groq free-tier limits are tight] → Short prompt, terse tool descriptions, 20-message window, step limit 5; measure token usage per turn in the live test and record it.
  Measured on `openai/gpt-oss-120b` in a four-turn quote and booking: 1.4K to 2.1K input tokens and 100 to 150 output tokens per turn, two steps each, about 1 to 1.5 seconds.
  Input grows about 200 tokens a turn, so a full 20-message window should stay under 4K, which still allows two turns a minute per model.
- [Fallback model is weaker at tool calls] → The live test runs on both models; if the fallback fails the pricing scenario, drop it and send the busy reply instead.
- [The amount guard rejects a legitimate amount] → It only checks amounts that look like currency, and every legitimate amount comes from a tool, so a false positive means the prompt needs fixing; it falls back to the code-built quote, never to silence.

## Migration Plan

Adds conversation tables and the `bookings.conversation_id` foreign key.
No existing rows to migrate.
