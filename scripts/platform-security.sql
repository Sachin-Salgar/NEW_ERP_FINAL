-- Run as the database owner, not through the application.
-- Supply passwords through the operator secret manager; do not commit them here.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_app') THEN
    CREATE ROLE erp_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_platform_executor') THEN
    CREATE ROLE erp_platform_executor NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_procedure_owner') THEN
    CREATE ROLE erp_procedure_owner NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOLOGIN;
  END IF;
END $$;
DO $$
BEGIN
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO erp_app, erp_platform_executor, erp_procedure_owner',
    current_database()
  );
END $$;
GRANT USAGE ON SCHEMA public TO erp_app, erp_platform_executor, erp_procedure_owner;
REVOKE ALL ON FUNCTION platform_update_tenant_status(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform_delete_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_update_tenant_status(uuid, text) TO erp_platform_executor;
GRANT EXECUTE ON FUNCTION platform_delete_tenant(uuid) TO erp_platform_executor;

DROP POLICY IF EXISTS tenant_isolation_policy ON public.user_sessions;
CREATE POLICY tenant_isolation_policy ON public.user_sessions
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS user_sessions_active_location_policy ON public.user_sessions;
CREATE POLICY user_sessions_active_location_policy ON public.user_sessions
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    AND (organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)
    AND (location_id IS NULL OR location_id = NULLIF(current_setting('app.current_location_id', true), '')::uuid)
    AND (
      location_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.user_location_access ula
        WHERE ula.tenant_id = user_sessions.tenant_id
          AND ula.user_id = user_sessions.user_id
          AND ula.location_id = user_sessions.location_id
          AND ula.is_active = true
      )
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    AND (organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)
    AND (location_id IS NULL OR location_id = NULLIF(current_setting('app.current_location_id', true), '')::uuid)
    AND (
      location_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.user_location_access ula
        WHERE ula.tenant_id = user_sessions.tenant_id
          AND ula.user_id = user_sessions.user_id
          AND ula.location_id = user_sessions.location_id
          AND ula.is_active = true
      )
    )
  );

DROP POLICY IF EXISTS platform_session_context_policy ON public.user_sessions;
CREATE POLICY platform_session_context_policy ON public.user_sessions
  FOR SELECT
  USING (
    context_type = 'platform'
    AND tenant_id IS NULL
    AND user_id IS NULL
    AND platform_membership_id IS NOT NULL
  );

DROP POLICY IF EXISTS platform_session_insert_policy ON public.user_sessions;
CREATE POLICY platform_session_insert_policy ON public.user_sessions
  FOR INSERT
  WITH CHECK (
    context_type = 'platform'
    AND tenant_id IS NULL
    AND user_id IS NULL
    AND platform_membership_id IS NOT NULL
    AND current_setting('app.platform_session_enabled', true) = 'true'
  );
