import { sql } from "drizzle-orm";

import type { Db } from "@/db/client";

export type HandedOver = {
  id: string;
  // The WhatsApp name if Kapso sent one, else the number's last 4 digits.
  who: string;
  since: Date;
  // Why a person has it, from the ownership note: "the customer asked to cancel a booking".
  because: string;
  preview: string;
  lastFrom: "customer" | "ai" | "human";
  // Set when the contact has a WhatsApp number: when they last wrote there,
  // and when that was read, so a countdown starts from the same moment.
  whatsapp: { lastInboundAt: Date | null; loadedAt: Date } | null;
};

type Row = {
  id: string;
  display_name: string | null;
  whatsapp: string | null;
  since: string | Date;
  wa_last_inbound_at: string | Date | null;
  because: string | null;
  body: string | null;
  sent_by: "customer" | "ai" | "human" | null;
};

// The conversations a person owns, longest waiting first. Kapso's inbox lists
// everything else, so the agent's conversations are left out.
export async function listHandedOver(db: Db, limit = 50): Promise<HandedOver[]> {
  const result = await db.execute<Row>(sql`
    select c.id, ct.display_name, wa.external_id as whatsapp,
           coalesce(c.owner_changed_at, c.updated_at) as since, c.wa_last_inbound_at,
           note.because, m.body, m.sent_by
    from conversations c
    join contacts ct on ct.id = c.contact_id
    left join lateral (
      select external_id from channel_identities
      where contact_id = c.contact_id and channel = 'whatsapp'
      -- A phone number before a user id, which is never shown.
      order by external_id ~ '^[0-9]+$' desc limit 1
    ) wa on true
    left join lateral (
      select payload ->> 'because' as because from messages
      where conversation_id = c.id and sent_by = 'system' and payload ->> 'to' = 'human'
      order by id desc limit 1
    ) note on true
    left join lateral (
      select body, sent_by from messages
      where conversation_id = c.id and sent_by <> 'system'
      order by id desc limit 1
    ) m on true
    where c.owner = 'human'
    order by since asc
    limit ${limit}
  `);
  const loadedAt = new Date();
  return result.rows.map((row) => ({
    id: row.id,
    who: row.display_name ?? (row.whatsapp && /^\d+$/.test(row.whatsapp) ? `…${row.whatsapp.slice(-4)}` : "Customer"),
    since: new Date(row.since),
    because: row.because ?? "a person took it over",
    preview: !row.body ? "" : row.body.length > 90 ? `${row.body.slice(0, 89)}…` : row.body,
    lastFrom: row.sent_by ?? "customer",
    whatsapp: row.whatsapp ? { lastInboundAt: row.wa_last_inbound_at ? new Date(row.wa_last_inbound_at) : null, loadedAt } : null,
  }));
}
