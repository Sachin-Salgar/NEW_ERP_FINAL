ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "attempt_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "max_attempts" integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "lease_owner" varchar(255),
  ADD COLUMN IF NOT EXISTS "lease_expires_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "last_error" varchar(1000);
--> statement-breakpoint
ALTER TABLE "notifications"
  DROP CONSTRAINT IF EXISTS "check_notifications_attempts";
ALTER TABLE "notifications"
  ADD CONSTRAINT "check_notifications_attempts"
  CHECK ("attempt_count" >= 0 AND "max_attempts" > 0);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_claimable"
  ON "notifications" ("tenant_id", "available_at", "created_at")
  WHERE "status" IN ('pending', 'failed');
