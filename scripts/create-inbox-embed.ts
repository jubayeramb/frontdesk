// Creates (or revokes) the Kapso inbox embed that /staff shows.
// Usage:
//   pnpm inbox:embed --origin http://localhost:3000 [--origin https://...] [--write-env .env.local]
//   pnpm inbox:embed --revoke <embed-id>
// Reads KAPSO_API_KEY and KAPSO_PHONE_NUMBER_ID from the env or .env.local.
// Kapso returns the embed URL, which carries a token, only once. It is never
// printed: --write-env adds it to that file as KAPSO_INBOX_EMBED_URL, and
// without it the URL goes to a new owner-only file under tmp/.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const API = "https://api.kapso.ai/platform/v1/inbox_embeds";

const { values } = parseArgs({
  options: {
    origin: { type: "string", multiple: true, default: [] },
    "write-env": { type: "string" },
    revoke: { type: "string" },
    name: { type: "string", default: "Front Desk staff" },
  },
});

const apiKey = required("KAPSO_API_KEY");

async function kapso(method: string, url: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    redirect: "error",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Kapso answered ${response.status}: ${text.slice(0, 300)}`);
  return text ? (JSON.parse(text) as { data: Record<string, unknown> }) : undefined;
}

if (values.revoke) {
  await kapso("DELETE", `${API}/${encodeURIComponent(values.revoke)}`);
  console.log(`Revoked inbox embed ${values.revoke}. Create a new one and update KAPSO_INBOX_EMBED_URL.`);
  process.exit(0);
}

// An empty list would let any site embed the inbox.
if (values.origin.length === 0) throw new Error("Pass at least one --origin, e.g. --origin http://localhost:3000");
for (const origin of values.origin) {
  if (!/^https?:\/\/[^/]+$/.test(origin)) throw new Error(`Not an origin (scheme and host, no path): ${origin}`);
}

const envFile = values["write-env"];
if (envFile && existsSync(envFile) && /^KAPSO_INBOX_EMBED_URL=/m.test(readFileSync(envFile, "utf8"))) {
  throw new Error(`${envFile} already has KAPSO_INBOX_EMBED_URL. Revoke that embed first, then remove the line.`);
}

const created = await kapso("POST", API, {
  inbox_embed: {
    name: values.name,
    scope_type: "phone_number",
    scope_id: required("KAPSO_PHONE_NUMBER_ID"),
    allowed_origins: values.origin,
    default_mode: "system",
    language: "en",
  },
});
const embed = created!.data;
const url = String(embed.embed_url ?? "");
if (!url.startsWith("https://")) throw new Error(`Kapso returned no embed URL for embed ${String(embed.id)}`);

if (envFile) {
  appendFileSync(envFile, `\nKAPSO_INBOX_EMBED_URL=${url}\n`);
  console.log(`Added KAPSO_INBOX_EMBED_URL to ${envFile}.`);
} else {
  mkdirSync("tmp", { recursive: true });
  const file = `tmp/inbox-embed-${String(embed.id)}.txt`;
  // "wx" refuses to overwrite an existing file.
  writeFileSync(file, `${url}\n`, { mode: 0o600, flag: "wx" });
  console.log(`Wrote the embed URL to ${file}. Copy it into KAPSO_INBOX_EMBED_URL, then delete the file.`);
}
console.log(`Embed ${String(embed.id)}: ${String(embed.status)}, origins ${JSON.stringify(embed.allowed_origins)}`);

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
