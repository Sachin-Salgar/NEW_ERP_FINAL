-- CRM and Sales are part of the current ERP product baseline.
-- Ensure existing tenants and organizations are entitled to and have both modules enabled,
-- while preserving the tenant_modules / organization_modules access boundaries.

ALTER TABLE IF EXISTS "tenant_modules" DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE IF EXISTS "organization_modules" DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint

INSERT INTO "tenant_modules" (
  "tenant_id", "module_id", "enabled", "enabled_at"
)
SELECT t.id, m.id, true, NOW()
FROM "tenants" t
CROSS JOIN "modules" m
WHERE m.code IN ('crm', 'sales')
ON CONFLICT (tenant_id, module_id) DO UPDATE
SET
  enabled = true,
  enabled_at = NOW(),
  disabled_at = NULL,
  disabled_by = NULL;
--> statement-breakpoint

INSERT INTO "organization_modules" (
  "tenant_id", "organization_id", "module_id", "enabled", "enabled_at"
)
SELECT o.tenant_id, o.id, m.id, true, NOW()
FROM "organizations" o
CROSS JOIN "modules" m
WHERE m.code IN ('crm', 'sales')
ON CONFLICT (organization_id, module_id) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  enabled = true,
  enabled_at = NOW(),
  disabled_at = NULL,
  disabled_by = NULL;
--> statement-breakpoint

ALTER TABLE IF EXISTS "tenant_modules" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE IF EXISTS "tenant_modules" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE IF EXISTS "organization_modules" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE IF EXISTS "organization_modules" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Future tenants receive core modules plus the current CRM/Sales product baseline.
CREATE OR REPLACE FUNCTION "initialize_core_tenant_modules"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  previous_tenant_id text;
BEGIN
  previous_tenant_id := current_setting('app.current_tenant_id', true);
  PERFORM set_config('app.current_tenant_id', NEW.id::text, true);

  INSERT INTO "tenant_modules" (tenant_id, module_id, enabled, enabled_at)
  SELECT NEW.id, m.id, true, NOW()
  FROM "modules" m
  WHERE m.is_core = true OR m.code IN ('crm', 'sales')
  ON CONFLICT (tenant_id, module_id) DO UPDATE
  SET
    enabled = true,
    enabled_at = NOW(),
    disabled_at = NULL,
    disabled_by = NULL;

  IF previous_tenant_id IS NULL THEN
    RESET app.current_tenant_id;
  ELSE
    PERFORM set_config('app.current_tenant_id', previous_tenant_id, true);
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

-- Future organizations receive core modules plus the current CRM/Sales product baseline.
CREATE OR REPLACE FUNCTION "initialize_core_organization_modules"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO "organization_modules" (tenant_id, organization_id, module_id, enabled, enabled_at)
  SELECT NEW.tenant_id, NEW.id, m.id, true, NOW()
  FROM "modules" m
  WHERE m.is_core = true OR m.code IN ('crm', 'sales')
  ON CONFLICT (organization_id, module_id) DO UPDATE
  SET
    tenant_id = EXCLUDED.tenant_id,
    enabled = true,
    enabled_at = NOW(),
    disabled_at = NULL,
    disabled_by = NULL;
  RETURN NEW;
END;
$$;
