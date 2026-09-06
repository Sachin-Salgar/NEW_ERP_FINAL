-- Treat an unset transaction-local organization context as unrestricted within
-- the already tenant-scoped policy; PostgreSQL may expose RESET as an empty
-- string rather than NULL.
DROP POLICY IF EXISTS "organization_modules_tenant_org_isolation_policy" ON "organization_modules";

CREATE POLICY "organization_modules_tenant_org_isolation_policy"
ON "organization_modules"
AS PERMISSIVE FOR ALL
USING (
  "tenant_id" = current_setting('app.current_tenant_id', true)::uuid
  AND (
    NULLIF(current_setting('app.current_tenant_id_organization_id', true), '') IS NULL
    OR "organization_id" = NULLIF(current_setting('app.current_tenant_id_organization_id', true), '')::uuid
  )
)
WITH CHECK (
  "tenant_id" = current_setting('app.current_tenant_id', true)::uuid
  AND (
    NULLIF(current_setting('app.current_tenant_id_organization_id', true), '') IS NULL
    OR "organization_id" = NULLIF(current_setting('app.current_tenant_id_organization_id', true), '')::uuid
  )
);
