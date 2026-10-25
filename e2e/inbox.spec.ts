import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { createDb } from "../src/db/client";
import { E2E_ENV } from "./env";

async function signIn(page: Page) {
  await page.goto("/staff/sign-in");
  await page.getByLabel("Staff password").fill(E2E_ENV.STAFF_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/staff$/);
}

// A WhatsApp conversation a person has taken over, named per project so the
// desktop and phone runs do not share rows.
async function humanConversation(name: string) {
  const { pool } = createDb(E2E_ENV.DATABASE_URL, E2E_ENV.DATABASE_WS_PROXY);
  try {
    const contactId = randomUUID();
    const conversationId = randomUUID();
    await pool.query("insert into contacts (id, display_name) values ($1, $2)", [contactId, name]);
    await pool.query("insert into channel_identities (contact_id, channel, external_id) values ($1, 'whatsapp', $2)", [
      contactId,
      `88017${Math.floor(Math.random() * 1e8)}`,
    ]);
    await pool.query("insert into conversations (id, contact_id, owner, owner_changed_at) values ($1, $2, 'human', now())", [conversationId, contactId]);
    await pool.query(
      "insert into messages (conversation_id, channel, direction, sent_by, body) values ($1, 'whatsapp', 'inbound', 'customer', 'can I talk to a person')",
      [conversationId],
    );
    await pool.query(
      `insert into messages (conversation_id, channel, direction, sent_by, body, payload)
       values ($1, 'whatsapp', 'outbound', 'system', 'Handed to a person: the customer asked for a person.', $2)`,
      [conversationId, { kind: "ownership", from: "ai", to: "human", reason: "customer_requested", because: "the customer asked for a person" }],
    );
  } finally {
    await pool.end();
  }
}

let inboxLoads = 0;

test.beforeEach(async ({ page }) => {
  inboxLoads = 0;
  await page.route("https://inbox.kapso.example/**", (route) => {
    inboxLoads += 1;
    return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Stub inbox</title><p>Stub inbox</p>" });
  });
});

test("staff see the conversations a person owns and hand one back", async ({ page }, testInfo) => {
  const name = `Handoff ${testInfo.project.name}`;
  await humanConversation(name);
  await signIn(page);

  await expect(page.getByTitle("Kapso inbox")).toHaveAttribute("src", E2E_ENV.KAPSO_INBOX_EMBED_URL);
  const row = page.getByTestId("handed-over-row").filter({ hasText: name });
  await expect(row.getByText("the customer asked for a person")).toBeVisible();
  await expect(row.getByText("can I talk to a person")).toBeVisible();

  await row.getByRole("button", { name: "Hand back to AI" }).click();
  await expect(row).toHaveCount(0);
});

test("a takeover shows up without a reload, and the inbox frame stays put", async ({ page }, testInfo) => {
  await signIn(page);
  await expect(page.getByTitle("Kapso inbox")).toBeVisible();
  await expect.poll(() => inboxLoads).toBe(1);

  const name = `Live ${testInfo.project.name}`;
  await humanConversation(name);

  await expect(page.getByTestId("handed-over-row").filter({ hasText: name })).toBeVisible({ timeout: 8_000 });
  expect(inboxLoads).toBe(1);
});

test("no public response carries the inbox address", async ({ request }) => {
  for (const path of ["/", "/staff/sign-in", "/staff", "/staff/pricing"]) {
    const body = await (await request.get(path)).text();
    expect(body, path).not.toContain("e2e-embed-token");
    expect(body, path).not.toContain("inbox.kapso.example");
  }
});
