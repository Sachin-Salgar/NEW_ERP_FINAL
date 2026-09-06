INSERT INTO permissions (module_code, resource, action, scope, permission_key, display_name, is_system)
VALUES
  ('tenant-configuration', 'tenant.member', 'activate', 'tenant', 'tenant.member.activate', 'Activate tenant members', true),
  ('tenant-configuration', 'tenant.member', 'deactivate', 'tenant', 'tenant.member.deactivate', 'Deactivate tenant members', true)
ON CONFLICT (permission_key) DO UPDATE SET display_name = EXCLUDED.display_name, is_system = EXCLUDED.is_system;
