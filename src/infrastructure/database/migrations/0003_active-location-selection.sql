ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "location_id" uuid;
--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "fk_session_location_tenant" FOREIGN KEY ("location_id","tenant_id") REFERENCES "public"."locations"("id","tenant_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_sessions_tenant_location" ON "user_sessions" ("tenant_id","location_id");
--> statement-breakpoint
ALTER TABLE "user_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_sessions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "user_sessions_active_location_policy" ON "user_sessions";
--> statement-breakpoint
CREATE POLICY "user_sessions_active_location_policy"
ON "user_sessions"
USING (
  "tenant_id" = current_setting('app.current_tenant_id', true)::uuid
  AND (
    "organization_id" IS NULL
    OR "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
  AND (
    "location_id" IS NULL
    OR "location_id" = current_setting('app.current_location_id', true)::uuid
  )
  AND (
    "location_id" IS NULL
    OR EXISTS (
      SELECT 1
      FROM "user_location_access" ula
      WHERE ula."tenant_id" = "user_sessions"."tenant_id"
        AND ula."user_id" = "user_sessions"."user_id"
        AND ula."location_id" = "user_sessions"."location_id"
        AND ula."is_active" = true
    )
  )
)
WITH CHECK (
  "tenant_id" = current_setting('app.current_tenant_id', true)::uuid
  AND (
    "organization_id" IS NULL
    OR "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
  AND (
    "location_id" IS NULL
    OR "location_id" = current_setting('app.current_location_id', true)::uuid
  )
  AND (
    "location_id" IS NULL
    OR EXISTS (
      SELECT 1
      FROM "user_location_access" ula
      WHERE ula."tenant_id" = "user_sessions"."tenant_id"
        AND ula."user_id" = "user_sessions"."user_id"
        AND ula."location_id" = "user_sessions"."location_id"
        AND ula."is_active" = true
    )
  )
);
