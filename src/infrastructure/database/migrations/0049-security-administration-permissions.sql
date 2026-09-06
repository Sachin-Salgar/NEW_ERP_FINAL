-- Register the existing tenant-scoped session and audit administration capabilities.
-- Session revocation and audit reads are tenant-scoped and remain protected by RLS.
INSERT INTO permissions (module_code, resource, action, scope, permission_key, display_name, is_system)
VALUES
  ('security', 'session', 'read', 'tenant', 'security.session.read', 'View sessions', true),
  ('security', 'session', 'revoke', 'tenant', 'security.session.revoke', 'Revoke sessions', true),
  ('security', 'session', 'revoke_all', 'tenant', 'security.session.revoke_all', 'Revoke all user sessions', true),
  ('security', 'audit_log', 'read', 'tenant', 'security.audit_log.read', 'View audit logs', true)
ON CONFLICT (permission_key) DO UPDATE
SET module_code = EXCLUDED.module_code,
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    scope = EXCLUDED.scope,
    display_name = EXCLUDED.display_name,
    is_system = EXCLUDED.is_system;
