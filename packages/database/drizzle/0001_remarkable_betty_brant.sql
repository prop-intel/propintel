CREATE TABLE "analyses" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"job_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"domain" text NOT NULL,
	"scores" jsonb,
	"key_metrics" jsonb,
	"summary" jsonb,
	"report_s3_key" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analyses_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "crawled_pages" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"job_id" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"canonical_url" text,
	"status_code" integer,
	"content_type" varchar(255),
	"title" text,
	"meta_description" text,
	"h1" text,
	"word_count" integer,
	"language" text,
	"last_modified" text,
	"load_time_ms" integer,
	"data" jsonb,
	"snapshot_s3_key" text,
	"crawled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawler_visits" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"site_id" varchar(255) NOT NULL,
	"url_id" varchar(255),
	"crawler_id" varchar(50),
	"user_agent" text NOT NULL,
	"ip_address" varchar(45),
	"path" text NOT NULL,
	"source" varchar(20) DEFAULT 'pixel' NOT NULL,
	"visited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"response_code" integer,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "crawlers" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"company" varchar(100) NOT NULL,
	"user_agent_pattern" text NOT NULL,
	"description" text,
	"category" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"site_id" varchar(255),
	"target_url" text NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"config" jsonb,
	"competitors" jsonb DEFAULT '[]'::jsonb,
	"webhook_url" text,
	"auth_config" jsonb,
	"llm_model" varchar(100) DEFAULT 'gpt-4o-mini',
	"progress" jsonb DEFAULT '{"pagesCrawled":0,"pagesTotal":0,"currentPhase":"pending"}'::jsonb,
	"metrics" jsonb DEFAULT '{"apiCallsCount":0,"storageUsedBytes":0}'::jsonb,
	"error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"job_id" varchar(255) NOT NULL,
	"s3_key_json" text,
	"s3_key_markdown" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "site_urls" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"site_id" varchar(255) NOT NULL,
	"path" text NOT NULL,
	"title" varchar(500),
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_crawled" timestamp with time zone,
	"crawl_count" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"domain" varchar(255) NOT NULL,
	"name" varchar(255),
	"tracking_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sites_tracking_id_unique" UNIQUE("tracking_id")
);
--> statement-breakpoint
ALTER TABLE "auth_account" DROP CONSTRAINT "auth_account_userId_auth_user_id_fk";
--> statement-breakpoint
ALTER TABLE "auth_session" DROP CONSTRAINT "auth_session_userId_auth_user_id_fk";
--> statement-breakpoint
DROP INDEX "t_user_id_idx";--> statement-breakpoint
DROP INDEX "account_user_id_idx";--> statement-breakpoint
ALTER TABLE "auth_account" DROP CONSTRAINT "auth_account_provider_providerAccountId_pk";--> statement-breakpoint
ALTER TABLE "auth_verification_token" ALTER COLUMN "identifier" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "auth_verification_token" ALTER COLUMN "token" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id");--> statement-breakpoint
ALTER TABLE "auth_account" ADD COLUMN "user_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_account" ADD COLUMN "provider_account_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_session" ADD COLUMN "session_token" varchar(255) PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_session" ADD COLUMN "user_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_user" ADD COLUMN "email_verified" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawled_pages" ADD CONSTRAINT "crawled_pages_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawler_visits" ADD CONSTRAINT "crawler_visits_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawler_visits" ADD CONSTRAINT "crawler_visits_url_id_site_urls_id_fk" FOREIGN KEY ("url_id") REFERENCES "public"."site_urls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawler_visits" ADD CONSTRAINT "crawler_visits_crawler_id_crawlers_id_fk" FOREIGN KEY ("crawler_id") REFERENCES "public"."crawlers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_urls" ADD CONSTRAINT "site_urls_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analyses_user_id_idx" ON "analyses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "analyses_domain_idx" ON "analyses" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "analyses_generated_at_idx" ON "analyses" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "crawled_pages_job_id_idx" ON "crawled_pages" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "crawler_visits_site_id_idx" ON "crawler_visits" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "crawler_visits_visited_at_idx" ON "crawler_visits" USING btree ("visited_at");--> statement-breakpoint
CREATE INDEX "crawler_visits_crawler_id_idx" ON "crawler_visits" USING btree ("crawler_id");--> statement-breakpoint
CREATE INDEX "jobs_user_id_idx" ON "jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "jobs_site_id_idx" ON "jobs" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_created_at_idx" ON "jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "reports_job_id_idx" ON "reports" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "site_urls_site_id_idx" ON "site_urls" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "sites_user_id_idx" ON "sites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sites_tracking_id_idx" ON "sites" USING btree ("tracking_id");--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "auth_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "auth_account" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "auth_account" DROP COLUMN "userId";--> statement-breakpoint
ALTER TABLE "auth_account" DROP COLUMN "providerAccountId";--> statement-breakpoint
ALTER TABLE "auth_session" DROP COLUMN "sessionToken";--> statement-breakpoint
ALTER TABLE "auth_session" DROP COLUMN "userId";--> statement-breakpoint
ALTER TABLE "auth_user" DROP COLUMN "emailVerified";