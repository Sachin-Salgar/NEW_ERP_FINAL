CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid,
  "channel" varchar(32) NOT NULL,
  "template_key" varchar(160) NOT NULL,
  "recipient" varchar(320),
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" varchar(32) NOT NULL DEFAULT 'pending',
  "available_at" timestamp with time zone NOT NULL DEFAULT now(),
  "sent_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "fk_notifications_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "check_notifications_channel" CHECK ("channel" IN ('email', 'in_app')),
  CONSTRAINT "check_notifications_status" CHECK ("status" IN ('pending', 'processing', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_due" ON "notifications" ("tenant_id", "status", "available_at");
ALTER TABLE IF EXISTS "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "notifications" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_tenant_isolation_policy" ON "notifications";
CREATE POLICY "notifications_tenant_isolation_policy" ON "notifications" AS PERMISSIVE FOR ALL
USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_delivery_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "notification_id" uuid NOT NULL,
  "attempt_no" integer NOT NULL,
  "provider" varchar(120),
  "outcome" varchar(32) NOT NULL,
  "error_code" varchar(160),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "fk_notification_attempt_notification" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE CASCADE,
  CONSTRAINT "check_notification_attempt_outcome" CHECK ("outcome" IN ('sent', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_notification_attempt_no" ON "notification_delivery_attempts" ("tenant_id", "notification_id", "attempt_no");
ALTER TABLE IF EXISTS "notification_delivery_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "notification_delivery_attempts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notification_delivery_attempts_tenant_isolation_policy" ON "notification_delivery_attempts";
CREATE POLICY "notification_delivery_attempts_tenant_isolation_policy" ON "notification_delivery_attempts" AS PERMISSIVE FOR ALL
USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stored_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "owner_user_id" uuid,
  "storage_key" varchar(1024) NOT NULL,
  "original_name" varchar(512) NOT NULL,
  "content_type" varchar(255) NOT NULL,
  "size_bytes" bigint NOT NULL,
  "checksum_sha256" varchar(64),
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone,
  CONSTRAINT "fk_stored_files_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "check_stored_files_size" CHECK ("size_bytes" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_stored_files_storage_key" ON "stored_files" ("tenant_id", "storage_key");
CREATE INDEX IF NOT EXISTS "idx_stored_files_active" ON "stored_files" ("tenant_id", "created_at" DESC) WHERE "deleted_at" IS NULL;
ALTER TABLE IF EXISTS "stored_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "stored_files" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stored_files_tenant_isolation_policy" ON "stored_files";
CREATE POLICY "stored_files_tenant_isolation_policy" ON "stored_files" AS PERMISSIVE FOR ALL
USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduled_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "job_type" varchar(160) NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "schedule_kind" varchar(32) NOT NULL,
  "cron_expression" varchar(255),
  "timezone" varchar(100) NOT NULL DEFAULT 'UTC',
  "next_run_at" timestamp with time zone NOT NULL,
  "lease_owner" varchar(255),
  "lease_expires_at" timestamp with time zone,
  "attempt_count" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 5,
  "status" varchar(32) NOT NULL DEFAULT 'scheduled',
  "last_error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "fk_scheduled_jobs_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "check_scheduled_jobs_kind" CHECK ("schedule_kind" IN ('once', 'recurring')),
  CONSTRAINT "check_scheduled_jobs_status" CHECK ("status" IN ('scheduled', 'running', 'completed', 'failed', 'cancelled')),
  CONSTRAINT "check_scheduled_jobs_attempts" CHECK ("max_attempts" > 0 AND "attempt_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scheduled_jobs_due" ON "scheduled_jobs" ("tenant_id", "status", "next_run_at");
ALTER TABLE IF EXISTS "scheduled_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "scheduled_jobs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scheduled_jobs_tenant_isolation_policy" ON "scheduled_jobs";
CREATE POLICY "scheduled_jobs_tenant_isolation_policy" ON "scheduled_jobs" AS PERMISSIVE FOR ALL
USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outbox_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "aggregate_type" varchar(160) NOT NULL,
  "aggregate_id" varchar(255) NOT NULL,
  "event_name" varchar(200) NOT NULL,
  "event_version" integer NOT NULL DEFAULT 1,
  "payload" jsonb NOT NULL,
  "correlation_id" varchar(255),
  "occurred_at" timestamp with time zone NOT NULL DEFAULT now(),
  "available_at" timestamp with time zone NOT NULL DEFAULT now(),
  "published_at" timestamp with time zone,
  "attempt_count" integer NOT NULL DEFAULT 0,
  "last_error" text,
  CONSTRAINT "fk_outbox_events_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "check_outbox_event_version" CHECK ("event_version" > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outbox_events_pending" ON "outbox_events" ("tenant_id", "available_at", "occurred_at") WHERE "published_at" IS NULL;
ALTER TABLE IF EXISTS "outbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "outbox_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "outbox_events_tenant_isolation_policy" ON "outbox_events";
CREATE POLICY "outbox_events_tenant_isolation_policy" ON "outbox_events" AS PERMISSIVE FOR ALL
USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
