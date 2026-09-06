-- ADR-0040 platform audit visibility and narrowly scoped procedure boundary.
ALTER TABLE audit_events ALTER COLUMN tenant_id DROP NOT NULL;
CREATE TABLE IF NOT EXISTS security_bootstrap_state (
  key varchar(40) PRIMARY KEY,
  used_at timestamptz,
  value jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS fk_audit_events_tenant;
ALTER TABLE audit_events ADD CONSTRAINT fk_audit_events_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
--> statement-breakpoint
DROP POLICY IF EXISTS audit_events_tenant_context_policy ON audit_events;
CREATE POLICY audit_events_context_visibility_policy ON audit_events
  FOR ALL
  USING (
    (context_type = 'tenant' AND tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    OR
    (context_type = 'platform' AND current_setting('app.platform_audit_enabled', true) = 'true')
  )
  WITH CHECK (
    (context_type = 'tenant' AND tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    OR
    (context_type = 'platform' AND current_setting('app.platform_audit_enabled', true) = 'true')
  );
--> statement-breakpoint
CREATE OR REPLACE FUNCTION platform_update_tenant_status(target_tenant uuid, requested_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF requested_status NOT IN ('active', 'inactive', 'suspended') THEN
    RAISE EXCEPTION 'invalid tenant lifecycle status';
  END IF;
  UPDATE tenants
  SET status = requested_status, updated_at = now()
  WHERE id = target_tenant AND is_deleted = false;
  IF NOT FOUND THEN RAISE EXCEPTION 'tenant not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION platform_update_tenant_status(uuid, text) FROM PUBLIC;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION platform_delete_tenant(target_tenant uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE tenants SET is_deleted = true, status = 'inactive', updated_at = now()
  WHERE id = target_tenant AND is_deleted = false;
  IF NOT FOUND THEN RAISE EXCEPTION 'tenant not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION platform_delete_tenant(uuid) FROM PUBLIC;
