-- Canonical Workflow/BPM migration: remove legacy module-local approval permissions.
-- Domain lifecycle permissions (submit/cancel/inspect/process/etc.) remain owned by modules.
BEGIN;

DELETE FROM public.role_permissions
WHERE permission_id IN (
  SELECT id FROM public.permissions
  WHERE permission_key IN (
    'purchase.requisition.approve',
    'purchase.requisition.reject',
    'purchase.requisition.workflow',
    'purchase.order.approve',
    'purchase.order.reject',
    'purchase.order.workflow',
    'purchase.receipt.workflow',
    'sales.return.approve',
    'sales.return.reject'
  )
);

DELETE FROM public.permissions
WHERE permission_key IN (
  'purchase.requisition.approve',
  'purchase.requisition.reject',
  'purchase.requisition.workflow',
  'purchase.order.approve',
  'purchase.order.reject',
  'purchase.order.workflow',
  'purchase.receipt.workflow',
  'sales.return.approve',
  'sales.return.reject'
);

COMMIT;
