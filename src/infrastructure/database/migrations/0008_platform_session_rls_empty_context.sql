-- Ensure tenant-session RLS fails closed when transaction tenant context is unset.
DROP POLICY IF EXISTS tenant_isolation_policy ON public.user_sessions;
CREATE POLICY tenant_isolation_policy ON public.user_sessions
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
