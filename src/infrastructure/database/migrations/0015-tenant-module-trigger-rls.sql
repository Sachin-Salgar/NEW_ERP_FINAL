-- Tenant bootstrap trigger must work even when the tenant is created before
-- any tenant context exists. Preserve the ambient context and temporarily bind
-- the new tenant while the trigger inserts its core entitlements.
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
  WHERE m.is_core = true
  ON CONFLICT (tenant_id, module_id) DO NOTHING;

  IF previous_tenant_id IS NULL THEN
    RESET app.current_tenant_id;
  ELSE
    PERFORM set_config('app.current_tenant_id', previous_tenant_id, true);
  END IF;

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
