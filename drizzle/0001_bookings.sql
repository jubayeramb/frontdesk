CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"tour_id" integer NOT NULL,
	"departs_on" date NOT NULL,
	"travelers" smallint NOT NULL,
	"quote" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_travelers_range" CHECK ("bookings"."travelers" between 1 and 10)
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tour_id_tours_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE no action ON UPDATE no action;