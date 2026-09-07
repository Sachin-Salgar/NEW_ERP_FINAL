-- Correct the platform tenant soft-delete procedure carried forward from the pre-consolidation history.
-- Tenant lifecycle deletion is guarded and uses the canonical tenant_status_enum value `cancelled`.

CREATE OR REPLACE FUNCTION public.platform_delete_tenant(target_tenant uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  protected_record_count bigint;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM public.users WHERE tenant_id = target_tenant AND is_deleted = false)
    + (SELECT COUNT(*) FROM public.organizations WHERE tenant_id = target_tenant AND is_deleted = false)
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

REVOKE ALL ON FUNCTION public.platform_delete_tenant(uuid) FROM PUBLIC;
