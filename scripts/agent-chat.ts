// Talk to the agent from a terminal, with no channel attached.
// Usage: pnpm agent:chat [--channel web|whatsapp]
// Uses DATABASE_URL (and DATABASE_WS_PROXY) from the env or .env.local; run
// `pnpm db:migrate && pnpm db:seed` against that database first.
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";

import { createDb } from "@/db/client";
import type { Channel } from "@/db/schema";
import { parseEnv } from "@/env-schema";
import { findOrCreateConversation } from "@/lib/conversations/store";
import { groqModels } from "@/lib/agent/model";
import type { AgentReply, ChoiceOption } from "@/lib/agent/replies";
import { runTurn } from "@/lib/agent/run-turn";

const { values } = parseArgs({ options: { channel: { type: "string", default: "web" } } });
const channel = values.channel as Channel;
if (channel !== "web" && channel !== "whatsapp") throw new Error("--channel must be web or whatsapp");

const env = parseEnv(process.env);
const { db, pool } = createDb(env.DATABASE_URL, env.DATABASE_WS_PROXY);
const models = groqModels(env.GROQ_API_KEY);

let conversationId = await newConversation();
let offered: ChoiceOption[] = [];

console.log(`Chatting as a ${channel} customer. Type a number to pick an option, /new to start over, /quit to leave.\n`);
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });

for await (const raw of rl) {
  const line = raw.trim();
  if (!line) continue;
  if (line === "/quit") break;
  if (line === "/new") {
    conversationId = await newConversation();
    offered = [];
    console.log("(new conversation)\n");
    continue;
  }
  if (!process.stdin.isTTY) console.log(`you> ${line}`);

  // A number picks an offered option, like tapping a button.
  const picked = /^\d+$/.test(line) ? offered[Number(line) - 1] : undefined;
  const inbound = picked ? { text: picked.label, choiceId: picked.id } : { text: line };

  const started = Date.now();
  const { replies } = await runTurn({
    db,
    conversationId,
    channel,
    inbound,
    now: new Date(),
    models,
    onModelResult: (info) =>
      console.log(
        `  [${info.modelId}, ${info.steps} steps, ${info.inputTokens}+${info.outputTokens} tokens, ${Date.now() - started}ms]`,
      ),
  });
  offered = print(replies);
}

rl.close();
await pool.end();

async function newConversation() {
  const conversation = await findOrCreateConversation(db, { channel, externalId: `cli-${randomUUID()}` });
  return conversation.id;
}

function print(replies: AgentReply[]): ChoiceOption[] {
  let options: ChoiceOption[] = [];
  for (const reply of replies) {
    if (reply.kind === "choices") {
      console.log(`agent> ${reply.prompt}`);
      reply.options.forEach((o, i) => console.log(`  ${i + 1}. ${o.label}`));
      options = reply.options;
    } else if (reply.kind === "link") {
      console.log(`agent> ${reply.text} [${reply.label}: ${reply.url}]`);
    } else {
      console.log(`agent> ${reply.text}`);
    }
  }
  console.log("");
  return options;
}
