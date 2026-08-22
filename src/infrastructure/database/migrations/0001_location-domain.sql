-- Consolidated location domain migration (final state)
-- Combines previous 0001..0005 location-related migrations into a single authoritative migration.

-- 1) locations table (domain foundation)
CREATE TABLE IF NOT EXISTS "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "org_status_enum" DEFAULT 'active' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"address_line1" text,
	"address_line2" text,
	"city" varchar(100),
	"state" varchar(100),
	"country" varchar(100),
	"postal_code" varchar(20),
	"timezone" varchar(100) DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint

-- 2) foreign keys for locations
ALTER TABLE IF EXISTS "locations" DROP CONSTRAINT IF EXISTS "locations_tenant_id_tenants_id_fk";
ALTER TABLE IF EXISTS "locations" ADD CONSTRAINT "locations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE IF EXISTS "locations" DROP CONSTRAINT IF EXISTS "fk_location_org_tenant";
ALTER TABLE IF EXISTS "locations" ADD CONSTRAINT "fk_location_org_tenant" FOREIGN KEY ("organization_id","tenant_id") REFERENCES "public"."organizations"("id","tenant_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- 3) indexes and unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "uq_location_id_tenant" ON "locations" ("id","tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_tenant_org_location_code_active" ON "locations" ("tenant_id","organization_id","code") WHERE "is_deleted" = false;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_default_location" ON "locations" ("organization_id") WHERE "is_default" = true AND "is_deleted" = false;
--> statement-breakpoint

-- 4) soft-delete check constraint
ALTER TABLE IF EXISTS "locations" DROP CONSTRAINT IF EXISTS "check_location_soft_delete";
ALTER TABLE IF EXISTS "locations" ADD CONSTRAINT "check_location_soft_delete" CHECK ((("is_deleted" = false AND "deleted_at" IS NULL) OR ("is_deleted" = true AND "deleted_at" IS NOT NULL)));
--> statement-breakpoint

-- 5) user_location_access (authorization)
CREATE TABLE IF NOT EXISTS "user_location_access" (
  "tenant_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "location_id" uuid NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "granted_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone,
  CONSTRAINT user_location_access_pkey PRIMARY KEY ("user_id","location_id","tenant_id")
);
--> statement-breakpoint

-- 6) foreign keys and indexes for user_location_access
ALTER TABLE IF EXISTS "user_location_access" DROP CONSTRAINT IF EXISTS "user_location_access_tenant_id_tenants_id_fk";
ALTER TABLE IF EXISTS "user_location_access" ADD CONSTRAINT "user_location_access_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE IF EXISTS "user_location_access" DROP CONSTRAINT IF EXISTS "fk_ula_access_user";
ALTER TABLE IF EXISTS "user_location_access" ADD CONSTRAINT "fk_ula_access_user" FOREIGN KEY ("user_id","tenant_id") REFERENCES "public"."users"("id","tenant_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE IF EXISTS "user_location_access" DROP CONSTRAINT IF EXISTS "fk_ula_access_org";
ALTER TABLE IF EXISTS "user_location_access" ADD CONSTRAINT "fk_ula_access_org" FOREIGN KEY ("organization_id","tenant_id") REFERENCES "public"."organizations"("id","tenant_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE IF EXISTS "user_location_access" DROP CONSTRAINT IF EXISTS "fk_ula_access_location";
ALTER TABLE IF EXISTS "user_location_access" ADD CONSTRAINT "fk_ula_access_location" FOREIGN KEY ("location_id","tenant_id") REFERENCES "public"."locations"("id","tenant_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_location_access_tenant_user" ON "user_location_access" ("tenant_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_location_access_tenant_org" ON "user_location_access" ("tenant_id","organization_id");
--> statement-breakpoint

-- 7) user_sessions active location selection
ALTER TABLE IF EXISTS "user_sessions" ADD COLUMN IF NOT EXISTS "location_id" uuid;
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_user_sessions_tenant_location";
--> statement-breakpoint
ALTER TABLE IF EXISTS "user_sessions" DROP CONSTRAINT IF EXISTS "fk_session_location_tenant";
--> statement-breakpoint
ALTER TABLE IF EXISTS "user_sessions" DROP CONSTRAINT IF EXISTS "fk_session_location_tenant";
ALTER TABLE IF EXISTS "user_sessions" ADD CONSTRAINT "fk_session_location_tenant" FOREIGN KEY ("location_id","tenant_id") REFERENCES "public"."locations"("id","tenant_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_sessions_tenant_location" ON "user_sessions" ("tenant_id","location_id");
--> statement-breakpoint

-- 8) enable RLS & FORCE RLS on involved tables
ALTER TABLE IF EXISTS "user_location_access" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE IF EXISTS "user_location_access" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE IF EXISTS "locations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE IF EXISTS "locations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE IF EXISTS "user_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE IF EXISTS "user_sessions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- 9) policies: user_location_access tenant isolation
DROP POLICY IF EXISTS "user_location_access_tenant_isolation_policy" ON "user_location_access";
--> statement-breakpoint
CREATE POLICY "user_location_access_tenant_isolation_policy"
ON "user_location_access"
USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
--> statement-breakpoint

-- 10) policies: locations tenant/org access and tenant isolation
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
--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_isolation_policy" ON "locations";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy"
ON "locations"
AS PERMISSIVE FOR ALL
USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
--> statement-breakpoint

-- 11) user_sessions active location policy
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
--> statement-breakpoint

-- 12) final placement: ensure constraints and indexes exist after policy creation
-- (no-op statements to make migration idempotent)

-- End of consolidated 0001_location-domain migration
