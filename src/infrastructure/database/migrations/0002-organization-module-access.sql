-- Organization-scoped module enablement.
-- tenant_modules remains the tenant/subscription entitlement boundary;
-- organization_modules is the business-organization enablement boundary.

CREATE TABLE IF NOT EXISTS "organization_modules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "module_id" uuid NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "enabled_at" timestamp with time zone DEFAULT now() NOT NULL,
  "enabled_by" uuid,
  "disabled_at" timestamp with time zone,
  "disabled_by" uuid,
  CONSTRAINT "uq_organization_module" UNIQUE ("organization_id", "module_id"),
  CONSTRAINT "check_organization_module_lifecycle" CHECK (
    ("enabled" = true AND "disabled_at" IS NULL)
    OR ("enabled" = false AND "disabled_at" IS NOT NULL)
  )
);
--> statement-breakpoint

ALTER TABLE IF EXISTS "organization_modules" DROP CONSTRAINT IF EXISTS "fk_organization_modules_tenant";
ALTER TABLE IF EXISTS "organization_modules"
  ADD CONSTRAINT "fk_organization_modules_tenant"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE IF EXISTS "organization_modules" DROP CONSTRAINT IF EXISTS "fk_organization_modules_organization";
ALTER TABLE IF EXISTS "organization_modules"
  ADD CONSTRAINT "fk_organization_modules_organization"
  FOREIGN KEY ("organization_id", "tenant_id")
  REFERENCES "public"."organizations"("id", "tenant_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE IF EXISTS "organization_modules" DROP CONSTRAINT IF EXISTS "fk_organization_modules_module";
ALTER TABLE IF EXISTS "organization_modules"
  ADD CONSTRAINT "fk_organization_modules_module"
  FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_organization_modules_tenant_org"
  ON "organization_modules" ("tenant_id", "organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organization_modules_tenant_module"
  ON "organization_modules" ("tenant_id", "module_id");
--> statement-breakpoint

-- Existing organizations receive all currently-defined core modules.
-- This backfill intentionally runs before RLS is enabled on organization_modules,
-- because migration execution has no single tenant/organization context.
INSERT INTO "organization_modules" (
  "tenant_id", "organization_id", "module_id", "enabled", "enabled_at"
)
SELECT o.tenant_id, o.id, m.id, true, NOW()
FROM "organizations" o
CROSS JOIN "modules" m
WHERE m.is_core = true
ON CONFLICT (organization_id, module_id) DO NOTHING;
--> statement-breakpoint

-- Existing tenants receive all currently-defined core modules as platform entitlements.
-- This backfill runs outside tenant-specific RLS context, so it temporarily bypasses
-- the tenant_modules policy during the migration and restores it afterwards.
ALTER TABLE IF EXISTS "tenant_modules" DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint
INSERT INTO "tenant_modules" (
  "tenant_id", "module_id", "enabled", "enabled_at"
)
SELECT t.id, m.id, true, NOW()
FROM "tenants" t
CROSS JOIN "modules" m
WHERE m.is_core = true
ON CONFLICT (tenant_id, module_id) DO NOTHING;
--> statement-breakpoint
ALTER TABLE IF EXISTS "tenant_modules" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE IF EXISTS "tenant_modules" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE IF EXISTS "organization_modules" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE IF EXISTS "organization_modules" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS "organization_modules_tenant_org_isolation_policy" ON "organization_modules";
--> statement-breakpoint
CREATE POLICY "organization_modules_tenant_org_isolation_policy"
ON "organization_modules"
AS PERMISSIVE FOR ALL
USING (
  "tenant_id" = current_setting('app.current_tenant_id', true)::uuid
  AND (
    current_setting('app.current_organization_id', true) IS NULL
    OR "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
)
WITH CHECK (
  "tenant_id" = current_setting('app.current_tenant_id', true)::uuid
  AND (
    current_setting('app.current_organization_id', true) IS NULL
    OR "organization_id" = current_setting('app.current_organization_id', true)::uuid
  )
);
--> statement-breakpoint

-- New organizations automatically receive core modules.
CREATE OR REPLACE FUNCTION "initialize_core_organization_modules"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO "organization_modules" (tenant_id, organization_id, module_id, enabled, enabled_at)
  SELECT NEW.tenant_id, NEW.id, m.id, true, NOW()
  FROM "modules" m
  WHERE m.is_core = true
  ON CONFLICT (organization_id, module_id) DO NOTHING;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "trg_initialize_core_organization_modules" ON "organizations";
--> statement-breakpoint
CREATE TRIGGER "trg_initialize_core_organization_modules"
AFTER INSERT ON "organizations"
FOR EACH ROW
EXECUTE FUNCTION "initialize_core_organization_modules"();
--> statement-breakpoint

-- New tenants automatically receive core platform entitlements.
CREATE OR REPLACE FUNCTION "initialize_core_tenant_modules"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO "tenant_modules" (tenant_id, module_id, enabled, enabled_at)
  SELECT NEW.id, m.id, true, NOW()
  FROM "modules" m
  WHERE m.is_core = true
  ON CONFLICT (tenant_id, module_id) DO NOTHING;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "trg_initialize_core_tenant_modules" ON "tenants";
--> statement-breakpoint
CREATE TRIGGER "trg_initialize_core_tenant_modules"
AFTER INSERT ON "tenants"
FOR EACH ROW
EXECUTE FUNCTION "initialize_core_tenant_modules"();
--> statement-breakpoint

-- End of organization module access migration.