CREATE TABLE IF NOT EXISTS "user_location_access" (
  "tenant_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "location_id" uuid NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "granted_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user_location_access" ADD CONSTRAINT "user_location_access_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_location_access" ADD CONSTRAINT "fk_ula_access_user" FOREIGN KEY ("user_id","tenant_id") REFERENCES "public"."users"("id","tenant_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_location_access" ADD CONSTRAINT "fk_ula_access_org" FOREIGN KEY ("organization_id","tenant_id") REFERENCES "public"."organizations"("id","tenant_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_location_access" ADD CONSTRAINT "fk_ula_access_location" FOREIGN KEY ("location_id","tenant_id") REFERENCES "public"."locations"("id","tenant_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_location_access" ADD CONSTRAINT "user_location_access_pkey" PRIMARY KEY ("user_id","location_id","tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_location_access_tenant_user" ON "user_location_access" ("tenant_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_location_access_tenant_org" ON "user_location_access" ("tenant_id","organization_id");
--> statement-breakpoint
ALTER TABLE "user_location_access" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_location_access" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "user_location_access_tenant_isolation_policy" ON "user_location_access";
--> statement-breakpoint
CREATE POLICY "user_location_access_tenant_isolation_policy"
ON "user_location_access"
USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
--> statement-breakpoint
DROP POLICY IF EXISTS "locations_tenant_and_org_access_policy" ON "locations";
--> statement-breakpoint
CREATE POLICY "locations_tenant_and_org_access_policy"
ON "locations"
USING (
  "tenant_id" = current_setting('app.current_tenant_id', true)::uuid
  AND (
    current_setting('app.current_organization_id', true) IS NULL
    OR "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
  AND "is_deleted" = false
  AND (
    current_setting('app.current_user_id', true) IS NULL
    OR EXISTS (
      SELECT 1
      FROM "user_location_access" ula
      WHERE ula."tenant_id" = "locations"."tenant_id"
        AND ula."organization_id" = "locations"."organization_id"
        AND ula."location_id" = "locations"."id"
        AND ula."user_id" = current_setting('app.current_user_id', true)::uuid
        AND ula."is_active" = true
    )
  )
)
WITH CHECK (
  "tenant_id" = current_setting('app.current_tenant_id', true)::uuid
  AND (
    current_setting('app.current_organization_id', true) IS NULL
    OR "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
  AND "is_deleted" = false
);
