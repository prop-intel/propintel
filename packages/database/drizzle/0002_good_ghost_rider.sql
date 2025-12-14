CREATE TABLE "unmatched_user_agents" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"site_id" varchar(255) NOT NULL,
	"user_agent" text NOT NULL,
	"path" text NOT NULL,
	"ip_address" varchar(45),
	"source" varchar(20) DEFAULT 'pixel' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "unmatched_user_agents" ADD CONSTRAINT "unmatched_user_agents_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "unmatched_user_agents_site_id_idx" ON "unmatched_user_agents" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "unmatched_user_agents_created_at_idx" ON "unmatched_user_agents" USING btree ("created_at");