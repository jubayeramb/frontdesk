import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  jsonb,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

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

// A stored booking with the quote it was made at. No capacity: this is a demo.
export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    // Foreign key to conversations arrives with add-agent-core.
    conversationId: uuid("conversation_id").notNull(),
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

export type Tour = typeof tours.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
