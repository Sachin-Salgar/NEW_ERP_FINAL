-- Align organization module RLS with the transaction context used by the
-- application. The previous policy read app.current_organization_id, while
-- tenant-context sets app.current_tenant_id_organization_id.
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
