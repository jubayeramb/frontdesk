import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The secret every fixture is signed with (see test/fixtures/kapso/README.md).
export const FIXTURE_SECRET = "test-webhook-secret";

export type KapsoFixture = {
  description: string;
  headers: Record<string, string>;
  // The exact raw body, so signatures verify on the bytes Kapso sent.
  body: string;
};

export function kapsoFixture(name: string): KapsoFixture {
  return JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures/kapso", `${name}.json`), "utf8"));
}

// The parsed body's `message`, for tests of code that reads one event.
export function fixtureMessage(name: string) {
  return JSON.parse(kapsoFixture(name).body).message;
}

// A webhook request carrying a fixture, signed like Kapso signs it. `edit`
// changes the parsed body first, and the request is re-signed to match.
export function fixtureRequest(
  name: string,
  edit?: (body: Record<string, unknown>) => void,
  opts: { secret?: string; event?: string } = {},
): Request {
  const fixture = kapsoFixture(name);
  let body = fixture.body;
  if (edit) {
    const parsed = JSON.parse(body);
    edit(parsed);
    body = JSON.stringify(parsed);
  }
  const signature = createHmac("sha256", opts.secret ?? FIXTURE_SECRET).update(body).digest("hex");
  return new Request("http://localhost/api/webhooks/kapso", {
    method: "POST",
    headers: {
      ...fixture.headers,
      ...(opts.event ? { "x-webhook-event": opts.event } : {}),
      "x-webhook-signature": signature,
    },
    body,
  });
}
