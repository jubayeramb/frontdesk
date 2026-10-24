CREATE TABLE "price_list" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_list_single_row" CHECK ("price_list"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "tours" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"summary" text NOT NULL,
	"days" smallint NOT NULL,
	"price_per_person_bdt" integer NOT NULL,
	"departure_weekdays" smallint[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tours_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tours_price_positive" CHECK ("tours"."price_per_person_bdt" > 0),
	CONSTRAINT "tours_days_positive" CHECK ("tours"."days" > 0)
);
