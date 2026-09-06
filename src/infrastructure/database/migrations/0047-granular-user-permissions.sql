-- Replace the coarse user.manage capability with granular User actions.
-- Existing roles that had user.manage receive the equivalent granular capabilities.

INSERT INTO permissions (id, module_code, resource, action, scope, permission_key, display_name, description, is_system)
VALUES
  (gen_random_uuid(), 'user-management', 'user', 'read', 'organization', 'user.read', 'View users', 'View and search user accounts.', false),
  (gen_random_uuid(), 'user-management', 'user', 'create', 'organization', 'user.create', 'Create users', 'Create user accounts.', false),
  (gen_random_uuid(), 'user-management', 'user', 'update', 'organization', 'user.update', 'Update users', 'Update user profile, organization, branch, access, and role assignments.', false),
  (gen_random_uuid(), 'user-management', 'user', 'activate', 'organization', 'user.activate', 'Activate users', 'Activate an inactive user account.', false),
  (gen_random_uuid(), 'user-management', 'user', 'deactivate', 'organization', 'user.deactivate', 'Deactivate users', 'Deactivate an active user account while retaining history.', false)
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT rp.tenant_id, rp.role_id, p.id
FROM role_permissions rp
JOIN permissions legacy ON legacy.id = rp.permission_id AND legacy.permission_key = 'user.manage'
JOIN permissions p ON p.permission_key IN ('user.read', 'user.create', 'user.update', 'user.activate', 'user.deactivate')
ON CONFLICT (role_id, permission_id, tenant_id) DO NOTHING;

DELETE FROM role_permissions
WHERE permission_id = (SELECT id FROM permissions WHERE permission_key = 'user.manage');

DELETE FROM permissions
WHERE permission_key = 'user.manage';
