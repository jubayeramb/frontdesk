import { createServer } from "node:http";

import { FAKE_GROQ_PORT } from "./env";

// A stand-in for Groq's OpenAI-compatible chat API, so the built app runs its
// real turn loop, tools and price guard against a model that follows a fixed
// script. Run by playwright.config.ts next to the app.

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type ChatMessage =
  | { role: "system" | "user"; content: string | { type: string; text?: string }[] }
  | { role: "assistant"; content?: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

const TOURS = ["sundarbans", "sylhet", "bandarban"];
// Long enough that the typing indicator is on screen for a moment.
const DELAY_MS = 300;

let callId = 0;

export function respond(messages: ChatMessage[]): { content?: string; tool?: { name: string; input: object } } {
  const last = messages.at(-1);
  if (last?.role === "tool") return afterTool(messages, last);

  const said = textOf(last);
  const picked = /\(picked option id: ([^)]+)\)/.exec(said)?.[1];
  if (picked?.includes(":")) return { tool: { name: "bookDeparture", input: { departureId: picked } } };

  const lower = said.toLowerCase();
  const tour = TOURS.find((t) => lower.includes(t)) ?? (picked && TOURS.includes(picked) ? picked : undefined) ?? earlierTour(messages);
  const travelers = /(\d+)\s*(people|persons|travell?ers|of us|adults)/.exec(lower)?.[1];

  if (tour && /departure|when|dates|leave/.test(lower)) return { tool: { name: "listDepartures", input: { tourSlug: tour } } };
  if (tour && travelers) return { tool: { name: "getQuote", input: { tourSlug: tour, travelers: Number(travelers) } } };
  if (/tours|options|what do you/.test(lower)) return { tool: { name: "listTours", input: {} } };
  if (tour) return { content: "How many people are travelling?" };
  return { content: "Hi! I can help with the **Sundarbans**, **Sylhet** and **Bandarban** tours. Which one interests you?" };
}

function afterTool(messages: ChatMessage[], result: Extract<ChatMessage, { role: "tool" }>) {
  const call = messages
    .flatMap((m) => (m.role === "assistant" ? (m.tool_calls ?? []) : []))
    .find((c) => c.id === result.tool_call_id);
  const output = JSON.parse(result.content) as Record<string, unknown>;
  if (output.ok === false) return { content: `Sorry, that did not work: ${String(output.error)}` };
  switch (call?.function.name) {
    case "getQuote":
      return {
        content: `The ${String(output.tour)} for ${String(output.travelers)} is ${String(output.total)} in total (${String(output.pricePerPerson)} each). Want to see departures?`,
      };
    case "listDepartures":
      return { content: "Here are the next departures." };
    case "bookDeparture":
      return { content: `You're booked. Your reference is ${String(output.bookingReference)}.` };
    default:
      return { content: "Here are our tours." };
  }
}

function earlierTour(messages: ChatMessage[]): string | undefined {
  for (const message of [...messages].reverse()) {
    if (message.role !== "user") continue;
    const found = TOURS.find((t) => textOf(message).toLowerCase().includes(t));
    if (found) return found;
  }
  return undefined;
}

function textOf(message: ChatMessage | undefined): string {
  if (!message || !("content" in message) || !message.content) return "";
  return typeof message.content === "string" ? message.content : message.content.map((p) => p.text ?? "").join("");
}

const server = createServer((request, response) => {
  if (request.method === "GET") {
    response.writeHead(200).end("fake groq");
    return;
  }
  let raw = "";
  request.on("data", (chunk: Buffer) => (raw += chunk.toString()));
  request.on("end", () => {
    const body = JSON.parse(raw) as { model: string; messages: ChatMessage[] };
    const answer = respond(body.messages);
    const toolCalls: ToolCall[] | undefined = answer.tool
      ? [{ id: `call_${++callId}`, type: "function", function: { name: answer.tool.name, arguments: JSON.stringify(answer.tool.input) } }]
      : undefined;
    setTimeout(() => {
      response.writeHead(200, { "content-type": "application/json" }).end(
        JSON.stringify({
          id: `fake-${callId}`,
          created: Math.floor(Date.now() / 1000),
          model: body.model,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: answer.content ?? null, tool_calls: toolCalls },
              finish_reason: toolCalls ? "tool_calls" : "stop",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      );
    }, DELAY_MS);
  });
});

server.listen(FAKE_GROQ_PORT, () => console.log(`fake groq on ${FAKE_GROQ_PORT}`));
