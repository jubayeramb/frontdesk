CREATE TABLE "link_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by_identity" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "link_codes" ADD CONSTRAINT "link_codes_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_codes" ADD CONSTRAINT "link_codes_used_by_identity_channel_identities_id_fk" FOREIGN KEY ("used_by_identity") REFERENCES "public"."channel_identities"("id") ON DELETE set null ON UPDATE no action;