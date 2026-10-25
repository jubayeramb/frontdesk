import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { ConversationState } from "@/lib/conversations/state";
import type { Quote } from "@/lib/pricing/quote";

// Tour packages. Prices are whole taka.
export const tours = pgTable(
  "tours",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    summary: text("summary").notNull(),
    days: smallint("days").notNull(),
    pricePerPersonBdt: integer("price_per_person_bdt").notNull(),
    // 0 = Sunday ... 6 = Saturday, in Asia/Dhaka.
    departureWeekdays: smallint("departure_weekdays").array().notNull(),
    active: boolean("active").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("tours_price_positive", sql`${t.pricePerPersonBdt} > 0`),
    check("tours_days_positive", sql`${t.days} > 0`),
  ],
);

// A single row whose version goes up on every price edit.
export const priceList = pgTable(
  "price_list",
  {
    id: smallint("id").primaryKey().default(1),
    version: integer("version").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("price_list_single_row", sql`${t.id} = 1`)],
);

export const channelEnum = pgEnum("channel", ["web", "whatsapp"]);
export const ownerEnum = pgEnum("conversation_owner", ["ai", "human"]);
export const directionEnum = pgEnum("message_direction", ["inbound", "outbound"]);
export const senderEnum = pgEnum("message_sender", ["customer", "ai", "human", "system"]);
// `suppressed`: a reply a person's takeover overtook, kept but never sent.
export const deliveryEnum = pgEnum("message_delivery", ["pending", "sent", "failed", "suppressed"]);

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A way to reach a contact: a web visitor id or a WhatsApp number.
export const channelIdentities = pgTable(
  "channel_identities",
  {
    id: serial("id").primaryKey(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    channel: channelEnum("channel").notNull(),
    externalId: text("external_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("channel_identities_channel_external_id").on(t.channel, t.externalId)],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    owner: ownerEnum("owner").notNull().default("ai"),
    ownerChangedAt: timestamp("owner_changed_at", { withTimezone: true }),
    kapsoConversationId: text("kapso_conversation_id"),
    waLastInboundAt: timestamp("wa_last_inbound_at", { withTimezone: true }),
    state: jsonb("state").$type<ConversationState>().notNull().default({}),
    // Set when a link code moved this contact's WhatsApp number to a web
    // conversation; a closed conversation is kept but never continued.
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversations_contact_id_idx").on(t.contactId, t.createdAt)],
);

export const messages = pgTable(
  "messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    channel: channelEnum("channel").notNull(),
    direction: directionEnum("direction").notNull(),
    sentBy: senderEnum("sent_by").notNull(),
    body: text("body").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    // Set by the sender before a send, so an echo can be matched to our own message.
    clientNonce: text("client_nonce"),
    // The channel's id for the message (a WhatsApp wamid), once known.
    externalId: text("external_id").unique(),
    // Outbound channel sends only: pending until the channel accepts it.
    deliveryStatus: deliveryEnum("delivery_status"),
    deliveryError: text("delivery_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_conversation_id_idx").on(t.conversationId, t.id),
    // A resubmitted web message carries the same nonce, so it is stored once.
    uniqueIndex("messages_conversation_nonce").on(t.conversationId, t.clientNonce),
  ],
);

// A stored booking with the quote it was made at. No capacity: this is a demo.
export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    tourId: integer("tour_id")
      .notNull()
      .references(() => tours.id),
    departsOn: date("departs_on").notNull(),
    travelers: smallint("travelers").notNull(),
    quote: jsonb("quote").$type<Quote>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("bookings_travelers_range", sql`${t.travelers} between 1 and 10`)],
);

export const webhookStatusEnum = pgEnum("webhook_event_status", [
  "pending",
  "processing",
  "done",
  "failed",
]);

// Every webhook event, stored once and processed in arrival order per customer.
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    // The customer's WhatsApp number: events with the same key run one at a time.
    partitionKey: text("partition_key").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: webhookStatusEnum("status").notNull().default("pending"),
    attempts: smallint("attempts").notNull().default(0),
    error: text("error"),
    // A deferred event waits until then, and the customer's later events wait behind it.
    notBefore: timestamp("not_before", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhook_events_partition_idx").on(t.partitionKey, t.status, t.createdAt, t.id)],
);

// One-time codes that carry a web conversation over to WhatsApp.
export const linkCodes = pgTable("link_codes", {
  code: text("code").primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedByIdentity: integer("used_by_identity").references(() => channelIdentities.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Tour = typeof tours.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type Channel = (typeof channelEnum.enumValues)[number];
