-- Grant the dedicated platform executor the database privileges required by
-- platform-context administration APIs. RLS remains enabled; authorization is
-- enforced by platform preHandlers plus the platform-context policies.
GRANT USAGE ON SCHEMA public TO erp_platform_executor;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.tenants,
  public.modules,
  public.tenant_modules,
  public.identities,
  public.platform_memberships,
  public.platform_membership_roles,
  public.platform_permissions,
  public.platform_roles,
  public.platform_role_permissions,
  public.platform_security_policy
TO erp_platform_executor;

GRANT SELECT, INSERT ON TABLE public.audit_events TO erp_platform_executor;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO erp_platform_executor;
