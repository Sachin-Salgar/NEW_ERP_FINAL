ALTER TABLE "outbox_events"
  ADD COLUMN IF NOT EXISTS "lease_owner" varchar(255),
  ADD COLUMN IF NOT EXISTS "lease_expires_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outbox_events_claimable"
  ON "outbox_events" ("tenant_id", "available_at", "occurred_at")
  WHERE "published_at" IS NULL;
