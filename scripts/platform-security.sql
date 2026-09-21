-- Run as the database owner, not through the application.
-- Supply passwords through the operator secret manager; do not commit them here.
DO $$
DECLARE
  procedure_owner oid;
  platform_executor oid;
  member_name text;
  granted_role text;
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

  SELECT oid INTO procedure_owner FROM pg_roles WHERE rolname = 'erp_procedure_owner';
  SELECT oid INTO platform_executor FROM pg_roles WHERE rolname = 'erp_platform_executor';
  -- Render's managed database owner is not necessarily a PostgreSQL superuser.
  -- Only a superuser can change the SUPERUSER attribute, so do not make
  -- application startup depend on ALTER ROLE when the roles already exist.
  IF (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    ALTER ROLE erp_procedure_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    ALTER ROLE erp_platform_executor
      LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    ALTER ROLE erp_app
      LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp') THEN
      ALTER ROLE erp
        LOGIN NOSUPERUSER NOCREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS;
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_database
    WHERE datdba IN (procedure_owner, platform_executor)
  ) OR EXISTS (
    SELECT 1
    FROM pg_namespace
    WHERE nspname = 'public'
      AND nspowner IN (procedure_owner, platform_executor)
  ) OR EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relowner IN (procedure_owner, platform_executor)
  ) THEN
    RAISE EXCEPTION 'Dedicated platform roles must not own database, schema, or relation objects.';
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
REVOKE CREATE ON SCHEMA public FROM PUBLIC, erp_app, erp_platform_executor, erp_procedure_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM erp_platform_executor, erp_procedure_owner;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM erp_platform_executor, erp_procedure_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM erp_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM erp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO erp_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO erp_app;
DO $$
DECLARE
  object_owner text;
  grantee text;
BEGIN
  FOR object_owner IN
    SELECT CASE
      WHEN datdba = (SELECT oid FROM pg_roles WHERE rolname = current_user)
        THEN current_user
      ELSE 'erp'
    END
    FROM pg_database
    WHERE datname = current_database()
  LOOP
    -- Defaults belong to the role that creates the object, not the bootstrap operator.
    FOREACH grantee IN ARRAY ARRAY['PUBLIC', 'erp', 'erp_app', 'erp_platform_executor', 'erp_procedure_owner']
    LOOP
      IF object_owner = current_user THEN
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %s', grantee);
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %s', grantee);
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %s', grantee);
      ELSE
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM %s', object_owner, grantee);
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %s', object_owner, grantee);
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %s', object_owner, grantee);
      END IF;
    END LOOP;
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.platform_update_tenant_status(target_tenant uuid, requested_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF requested_status NOT IN ('active', 'suspended', 'cancelled') THEN
    RAISE EXCEPTION 'invalid tenant lifecycle status';
  END IF;
  UPDATE public.tenants
  SET status = requested_status::public.tenant_status_enum,
      is_deleted = (requested_status = 'cancelled'),
      deleted_at = CASE WHEN requested_status = 'cancelled' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = target_tenant AND (is_deleted = false OR requested_status = 'active');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tenant not found';
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.platform_delete_tenant(target_tenant uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  protected_record_count bigint;
BEGIN
  PERFORM set_config('app.current_tenant_id', target_tenant::text, true);

  SELECT
    (SELECT COUNT(*) FROM public.users WHERE tenant_id = target_tenant AND is_deleted = false)
    + (SELECT COUNT(*) FROM public.branches WHERE tenant_id = target_tenant AND is_deleted = false)
    + (SELECT COUNT(*) FROM public.audit_events WHERE tenant_id = target_tenant)
  INTO protected_record_count;

  IF protected_record_count > 0 THEN
    RAISE EXCEPTION 'Tenant deletion is blocked while tenant data or audit history exists.';
  END IF;

  UPDATE public.tenants
  SET status = 'cancelled'::public.tenant_status_enum,
      is_deleted = true,
      deleted_at = now(),
      updated_at = now()
  WHERE id = target_tenant AND is_deleted = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tenant not found';
  END IF;
END;
$$;
DO $$
DECLARE
  bootstrap_role text := current_user;
BEGIN
  EXECUTE format('GRANT erp_procedure_owner TO %I WITH ADMIN OPTION', bootstrap_role);
END $$;
-- The managed Render bootstrap operator may administer the role membership but is
-- not itself the owner of the security-definer functions. Switch into the
-- dedicated owner role for function replacement and ACL changes.
SET LOCAL ROLE erp_procedure_owner;
-- CREATE OR REPLACE preserves the existing function owner. On managed Render
-- PostgreSQL the bootstrap operator may administer the owner role but is not
-- itself the function owner, so perform owner-only function operations under
-- the dedicated procedure-owner role.
DO $platform$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles r ON r.oid = p.proowner
    WHERE n.nspname = 'public'
      AND p.proname = 'platform_update_tenant_status'
      AND pg_get_function_identity_arguments(p.oid) = 'target_tenant uuid, requested_status text'
      AND r.rolname <> 'erp_procedure_owner'
  ) THEN
    RAISE EXCEPTION 'Function platform_update_tenant_status must be owned by erp_procedure_owner; managed bootstrap cannot transfer ownership.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles r ON r.oid = p.proowner
    WHERE n.nspname = 'public'
      AND p.proname = 'platform_delete_tenant'
      AND pg_get_function_identity_arguments(p.oid) = 'target_tenant uuid'
      AND r.rolname <> 'erp_procedure_owner'
  ) THEN
    RAISE EXCEPTION 'Function platform_delete_tenant must be owned by erp_procedure_owner; managed bootstrap cannot transfer ownership.';
  END IF;
END $platform$;

GRANT SELECT, UPDATE ON public.tenants TO erp_procedure_owner;
GRANT SELECT ON public.users, public.branches, public.audit_events TO erp_procedure_owner;

REVOKE ALL ON FUNCTION public.platform_update_tenant_status(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_delete_tenant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_update_tenant_status(uuid, text) FROM erp, erp_app;
REVOKE ALL ON FUNCTION public.platform_delete_tenant(uuid) FROM erp, erp_app;
GRANT EXECUTE ON FUNCTION public.platform_update_tenant_status(uuid, text) TO erp_platform_executor;
GRANT EXECUTE ON FUNCTION public.platform_delete_tenant(uuid) TO erp_platform_executor;

RESET ROLE;

DROP POLICY IF EXISTS tenant_isolation_policy ON public.user_sessions;
CREATE POLICY tenant_isolation_policy ON public.user_sessions
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

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


-- Membership cleanup is intentionally last. A non-superuser bootstrap operator
-- may administer memberships when it has ADMIN OPTION, but it must retain any
-- temporary role membership until function ownership and grants are complete.
DO $$
DECLARE
  member_name text;
  granted_role text;
BEGIN
  FOR member_name, granted_role IN
    SELECT member.rolname, granted.rolname
    FROM pg_auth_members memberships
    JOIN pg_roles member ON member.oid = memberships.member
    JOIN pg_roles granted ON granted.oid = memberships.roleid
    WHERE member.rolname IN ('erp', 'erp_app', 'erp_platform_executor', 'erp_procedure_owner')
       OR granted.rolname IN ('erp', 'erp_app', 'erp_platform_executor', 'erp_procedure_owner')
  LOOP
    EXECUTE format('REVOKE %I FROM %I', granted_role, member_name);
  END LOOP;
END $$;
