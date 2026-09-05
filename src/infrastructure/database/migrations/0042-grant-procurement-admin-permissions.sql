INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r
JOIN role_permissions existing_rp ON existing_rp.tenant_id=r.tenant_id AND existing_rp.role_id=r.id
JOIN permissions existing_p ON existing_p.id=existing_rp.permission_id AND existing_p.permission_key='tenant.manage'
JOIN permissions p ON p.module_code='purchase'
ON CONFLICT (role_id, permission_id, tenant_id) DO NOTHING;
