ALTER TYPE "public"."message_delivery" ADD VALUE 'blocked';--> statement-breakpoint
CREATE TABLE "turns" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"contact_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"model" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "limit_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "turns" ADD CONSTRAINT "turns_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turns" ADD CONSTRAINT "turns_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "turns_contact_id_idx" ON "turns" USING btree ("contact_id","created_at");--> statement-breakpoint
CREATE INDEX "turns_created_at_idx" ON "turns" USING btree ("created_at");