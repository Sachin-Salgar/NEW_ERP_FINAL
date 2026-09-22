-- Synchronize platform administration authorization with the canonical platform permission contract.
-- Existing installations may have been provisioned before platform.modules.manage was added.
INSERT INTO public.platform_permissions
  (module_code, resource, action, scope, permission_key, display_name, is_system)
VALUES
  ('platform', 'module', '*', 'global', 'platform.modules.manage', 'Manage tenant module entitlements', true)
ON CONFLICT (permission_key) DO UPDATE
SET module_code = EXCLUDED.module_code,
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    scope = EXCLUDED.scope,
    display_name = EXCLUDED.display_name,
    is_system = EXCLUDED.is_system;

INSERT INTO public.platform_role_permissions (platform_role_id, platform_permission_id)
SELECT r.id, p.id
FROM public.platform_roles r
CROSS JOIN public.platform_permissions p
WHERE r.code = 'platform_owner'
  AND r.is_system = true
  AND p.permission_key IN (
    'platform.tenant.read',
    'platform.tenant.create',
    'platform.tenant.update',
    'platform.tenant.delete',
    'platform.tenant.activate',
    'platform.tenant.deactivate',
    'platform.tenant.suspend',
    'platform.tenant.reactivate',
    'platform.modules.manage',
    'platform.members.manage',
    'platform.roles.manage',
    'platform.permissions.manage',
    'platform.security.manage',
    'platform.audit.read',
    'platform.audit.export',
    'workflow.configuration.manage'
  )
ON CONFLICT DO NOTHING;
