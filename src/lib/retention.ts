import { createHash, timingSafeEqual } from "node:crypto";

import { sql } from "drizzle-orm";

import type { Db } from "@/db/client";

export const RETENTION_DAYS = 7;

export type Deleted = { conversations: number; contacts: number; webhookEvents: number };

// Deletes conversations with no activity for 7 days (their messages,
// bookings, link codes and turns go with them), then contacts left without
// one (with their identities), then webhook events finished that long ago.
// One transaction, so a failure leaves nothing half deleted. The cutoff is
// relative, so a missed day is caught up on the next run.
export async function deleteExpired(db: Db, now: Date): Promise<Deleted> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60_000).toISOString();
  return db.transaction(async (tx) => {
    const conversations = await tx.execute(sql`
      delete from conversations c
      where c.updated_at < ${cutoff}::timestamptz
        and not exists (select 1 from messages m where m.conversation_id = c.id and m.created_at >= ${cutoff}::timestamptz)
    `);
    const contacts = await tx.execute(sql`
      delete from contacts ct
      where ct.created_at < ${cutoff}::timestamptz
        and not exists (select 1 from conversations c where c.contact_id = ct.id)
    `);
    const webhookEvents = await tx.execute(sql`
      delete from webhook_events
      where status in ('done', 'failed') and updated_at < ${cutoff}::timestamptz
    `);
    return {
      conversations: conversations.rowCount ?? 0,
      contacts: contacts.rowCount ?? 0,
      webhookEvents: webhookEvents.rowCount ?? 0,
    };
  });
}

// Vercel's cron sends `Authorization: Bearer <CRON_SECRET>`; nothing else may
// run the job. Logs counts only.
export async function handleRetention(request: Request, deps: { db: Db; secret: string; now?: () => Date }): Promise<Response> {
  if (!authorized(request.headers.get("authorization"), deps.secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const deleted = await deleteExpired(deps.db, deps.now?.() ?? new Date());
  console.info(
    `retention deleted ${deleted.conversations} conversations, ${deleted.contacts} contacts, ${deleted.webhookEvents} webhook events`,
  );
  return Response.json(deleted);
}

// Compares digests, so neither the length nor the content leaks through timing.
function authorized(header: string | null, secret: string): boolean {
  if (!header) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}
