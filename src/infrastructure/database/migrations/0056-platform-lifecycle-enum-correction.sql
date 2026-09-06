CREATE OR REPLACE FUNCTION platform_update_tenant_status(target_tenant uuid, requested_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF requested_status NOT IN ('active', 'suspended', 'cancelled') THEN
    RAISE EXCEPTION 'invalid tenant lifecycle status';
  END IF;
  UPDATE tenants
  SET status = requested_status::tenant_status_enum,
      is_deleted = (requested_status = 'cancelled'),
      deleted_at = CASE WHEN requested_status = 'cancelled' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = target_tenant AND (is_deleted = false OR requested_status = 'active');
  IF NOT FOUND THEN RAISE EXCEPTION 'tenant not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION platform_update_tenant_status(uuid, text) FROM PUBLIC;
