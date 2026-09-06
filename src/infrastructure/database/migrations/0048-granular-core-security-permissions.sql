-- Replace implemented core/security manage capabilities with explicit actions.
-- Existing role assignments are expanded before the legacy catalog rows are removed.

INSERT INTO permissions (id, module_code, resource, action, scope, permission_key, display_name, description, is_system)
VALUES
  (gen_random_uuid(), 'organization', 'organization', 'read', 'organization', 'organization.read', 'View organizations', 'View organizations.', false),
  (gen_random_uuid(), 'organization', 'organization', 'create', 'organization', 'organization.create', 'Create organizations', 'Create organizations.', false),
  (gen_random_uuid(), 'organization', 'organization', 'update', 'organization', 'organization.update', 'Update organizations', 'Update organization details.', false),
  (gen_random_uuid(), 'organization', 'organization', 'deactivate', 'organization', 'organization.deactivate', 'Deactivate organizations', 'Deactivate organizations.', false),
  (gen_random_uuid(), 'organization', 'location', 'read', 'organization', 'organization.location.read', 'View locations', 'View accessible locations.', false),
  (gen_random_uuid(), 'organization', 'location', 'create', 'organization', 'organization.location.create', 'Create locations', 'Create locations.', false),
  (gen_random_uuid(), 'organization', 'location', 'update', 'organization', 'organization.location.update', 'Update locations', 'Update location details.', false),
  (gen_random_uuid(), 'organization', 'location', 'deactivate', 'organization', 'organization.location.deactivate', 'Deactivate locations', 'Deactivate locations.', false),
  (gen_random_uuid(), 'branch', 'branch', 'read', 'branch', 'branch.read', 'View branches', 'View accessible branches.', false),
  (gen_random_uuid(), 'branch', 'branch', 'create', 'branch', 'branch.create', 'Create branches', 'Create branches.', false),
  (gen_random_uuid(), 'branch', 'branch', 'update', 'branch', 'branch.update', 'Update branches', 'Update branch details.', false),
  (gen_random_uuid(), 'branch', 'branch', 'deactivate', 'branch', 'branch.deactivate', 'Deactivate branches', 'Deactivate branches.', false),
  (gen_random_uuid(), 'security', 'role', 'read', 'tenant', 'role.read', 'View roles', 'View roles.', false),
  (gen_random_uuid(), 'security', 'role', 'create', 'tenant', 'role.create', 'Create roles', 'Create roles.', false),
  (gen_random_uuid(), 'security', 'role', 'update', 'tenant', 'role.update', 'Update roles', 'Update role details.', false),
  (gen_random_uuid(), 'security', 'role_permission', 'read', 'tenant', 'role_permission.read', 'View role permissions', 'View role permission assignments.', false),
  (gen_random_uuid(), 'security', 'role_permission', 'grant', 'tenant', 'role_permission.grant', 'Grant role permissions', 'Grant permissions to roles.', false),
  (gen_random_uuid(), 'security', 'role_permission', 'revoke', 'tenant', 'role_permission.revoke', 'Revoke role permissions', 'Revoke permissions from roles.', false),
  (gen_random_uuid(), 'security', 'permission', 'read', 'tenant', 'permission.read', 'View permissions', 'View the application permission catalog.', false)
ON CONFLICT (permission_key) DO NOTHING;

WITH legacy_assignments AS (
  SELECT rp.tenant_id, rp.role_id, p.permission_key
  FROM role_permissions rp
  JOIN permissions p ON p.id = rp.permission_id
  WHERE p.permission_key IN (
    'organization.manage',
    'branch.manage',
    'role.manage',
    'permission.manage'
  )
), replacements AS (
  SELECT 'organization.manage' AS legacy_key, unnest(ARRAY[
    'organization.read', 'organization.create', 'organization.update', 'organization.deactivate',
    'organization.location.read', 'organization.location.create',
    'organization.location.update', 'organization.location.deactivate'
  ]) AS permission_key
  UNION ALL
  SELECT 'branch.manage', unnest(ARRAY['branch.read', 'branch.create', 'branch.update', 'branch.deactivate'])
  UNION ALL
  SELECT 'role.manage', unnest(ARRAY[
    'role.read', 'role.create', 'role.update',
    'role_permission.read', 'role_permission.grant', 'role_permission.revoke'
  ])
  UNION ALL
  SELECT 'permission.manage', 'permission.read'
)
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT la.tenant_id, la.role_id, replacement.id
FROM legacy_assignments la
JOIN replacements r ON r.legacy_key = la.permission_key
JOIN permissions replacement ON replacement.permission_key = r.permission_key
ON CONFLICT (role_id, permission_id, tenant_id) DO NOTHING;

DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT id
  FROM permissions
  WHERE permission_key IN ('organization.manage', 'branch.manage', 'role.manage', 'permission.manage', 'session.manage')
);

DELETE FROM permissions
WHERE permission_key IN ('organization.manage', 'branch.manage', 'role.manage', 'permission.manage', 'session.manage');
