CREATE TABLE IF NOT EXISTS security_policies (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  mfa_required boolean NOT NULL DEFAULT false,
  session_lifetime_minutes integer NOT NULL DEFAULT 43200 CHECK (session_lifetime_minutes BETWEEN 5 AND 43200),
  max_failed_login_attempts integer NOT NULL DEFAULT 5 CHECK (max_failed_login_attempts BETWEEN 1 AND 20),
  lockout_minutes integer NOT NULL DEFAULT 15 CHECK (lockout_minutes BETWEEN 1 AND 1440),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE security_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_policies FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS security_policies_tenant_isolation_policy ON security_policies;
CREATE POLICY security_policies_tenant_isolation_policy ON security_policies
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

INSERT INTO permissions (module_code, resource, action, scope, permission_key, display_name, is_system)
VALUES
  ('organization', 'organization', 'activate', 'organization', 'organization.activate', 'Activate organizations', true),
  ('organization', 'organization', 'delete', 'organization', 'organization.delete', 'Delete organizations', true),
  ('organization', 'location', 'activate', 'organization', 'organization.location.activate', 'Activate locations', true),
  ('organization', 'location', 'delete', 'organization', 'organization.location.delete', 'Delete locations', true),
  ('branch', 'branch', 'activate', 'branch', 'branch.activate', 'Activate branches', true),
  ('branch', 'branch', 'delete', 'branch', 'branch.delete', 'Delete branches', true),
  ('security', 'role', 'activate', 'tenant', 'role.activate', 'Activate roles', true),
  ('security', 'role', 'deactivate', 'tenant', 'role.deactivate', 'Deactivate roles', true),
  ('security', 'role', 'delete', 'tenant', 'role.delete', 'Delete roles', true),
  ('security', 'audit_log', 'export', 'tenant', 'security.audit_log.export', 'Export audit logs', true),
  ('security', 'policy', 'read', 'tenant', 'security.policy.read', 'View security policy', true),
  ('security', 'policy', 'update', 'tenant', 'security.policy.update', 'Update security policy', true),
  ('tenant-configuration', 'tenant', 'create', 'global', 'tenant.create', 'Create tenants', true),
  ('tenant-configuration', 'tenant', 'update', 'tenant', 'tenant.update', 'Update tenants', true),
  ('tenant-configuration', 'tenant', 'delete', 'global', 'tenant.delete', 'Delete tenants', true),
  ('tenant-configuration', 'tenant', 'activate', 'global', 'tenant.activate', 'Activate tenants', true),
  ('tenant-configuration', 'tenant', 'deactivate', 'global', 'tenant.deactivate', 'Deactivate tenants', true),
  ('tenant-configuration', 'tenant', 'suspend', 'global', 'tenant.suspend', 'Suspend tenants', true),
  ('tenant-configuration', 'tenant', 'reactivate', 'global', 'tenant.reactivate', 'Reactivate tenants', true),
  ('tenant-configuration', 'tenant.member', 'read', 'tenant', 'tenant.member.read', 'View tenant members', true),
  ('tenant-configuration', 'tenant.member', 'create', 'tenant', 'tenant.member.create', 'Add tenant members', true),
  ('tenant-configuration', 'tenant.member', 'update', 'tenant', 'tenant.member.update', 'Update tenant members', true),
  ('tenant-configuration', 'tenant.member', 'delete', 'tenant', 'tenant.member.delete', 'Remove tenant members', true),
  ('tenant-configuration', 'tenant.member', 'activate', 'tenant', 'tenant.member.activate', 'Activate tenant members', true),
  ('tenant-configuration', 'tenant.member', 'deactivate', 'tenant', 'tenant.member.deactivate', 'Deactivate tenant members', true),
  ('tenant-configuration', 'tenant.access', 'read', 'tenant', 'tenant.access.read', 'View tenant access', true),
  ('tenant-configuration', 'tenant.access', 'grant', 'tenant', 'tenant.access.grant', 'Grant tenant access', true),
  ('tenant-configuration', 'tenant.access', 'revoke', 'tenant', 'tenant.access.revoke', 'Revoke tenant access', true)
ON CONFLICT (permission_key) DO UPDATE SET module_code = EXCLUDED.module_code, resource = EXCLUDED.resource,
 action = EXCLUDED.action, scope = EXCLUDED.scope, display_name = EXCLUDED.display_name, is_system = EXCLUDED.is_system;
