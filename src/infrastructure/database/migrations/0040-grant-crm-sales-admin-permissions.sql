-- Grant baseline CRM/Sales read access to tenant administrators.
-- Tenant administrators are identified by roles that already grant tenant.manage;
-- no user, tenant, or organization identifiers are hard-coded.
-- Idempotent and limited to read/navigation permissions.

INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r
JOIN role_permissions existing_rp
  ON existing_rp.tenant_id = r.tenant_id
 AND existing_rp.role_id = r.id
JOIN permissions existing_p
  ON existing_p.id = existing_rp.permission_id
 AND existing_p.permission_key = 'tenant.manage'
JOIN permissions p
  ON p.permission_key IN (
    'customer.read',
    'sales.quotation.read',
    'sales.order.read',
    'sales.delivery.read',
    'sales.invoice.read',
    'sales.return.read',
    'sales.credit_note.read',
    'sales.reporting.read',
    'sales.pricing.read',
    'sales.discount.read'
  )
WHERE r.is_deleted = false
ON CONFLICT (role_id, permission_id, tenant_id) DO NOTHING;
