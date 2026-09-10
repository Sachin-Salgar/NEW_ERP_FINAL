-- Establish the dedicated SECURITY DEFINER ownership boundary.
-- The privileged security bootstrap must run immediately after this migration
-- to normalize role drift and transfer function ownership.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_procedure_owner') THEN
    CREATE ROLE erp_procedure_owner
      NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_platform_executor') THEN
    CREATE ROLE erp_platform_executor
      LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO erp_platform_executor, erp_procedure_owner',
    current_database()
  );
END
$$;
GRANT USAGE ON SCHEMA public TO erp_platform_executor, erp_procedure_owner;

REVOKE CREATE ON SCHEMA public FROM PUBLIC, erp_platform_executor, erp_procedure_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM erp_platform_executor, erp_procedure_owner;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM erp_platform_executor, erp_procedure_owner;

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

GRANT SELECT, UPDATE ON public.tenants TO erp_procedure_owner;
GRANT SELECT ON public.users, public.branches, public.audit_events TO erp_procedure_owner;

REVOKE ALL ON FUNCTION public.platform_update_tenant_status(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_delete_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_update_tenant_status(uuid, text) TO erp_platform_executor;
GRANT EXECUTE ON FUNCTION public.platform_delete_tenant(uuid) TO erp_platform_executor;
