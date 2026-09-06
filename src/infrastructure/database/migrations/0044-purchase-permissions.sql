UPDATE permissions
SET module_code='purchase',
    permission_key=replace(permission_key,'procurement.','purchase.')
WHERE module_code='procurement';

INSERT INTO permissions(module_code,resource,action,scope,permission_key,display_name,is_system)
VALUES
 ('purchase','supplier','update','organization','purchase.supplier.update','Update suppliers',true),
 ('purchase','supplier','delete','organization','purchase.supplier.delete','Delete suppliers',true),
 ('purchase','requisition','update','organization','purchase.requisition.update','Update purchase requisitions',true),
 ('purchase','requisition','workflow','organization','purchase.requisition.workflow','Change requisition lifecycle',true),
 ('purchase','requisition','submit','organization','purchase.requisition.submit','Submit purchase requisitions',true),
 ('purchase','requisition','approve','organization','purchase.requisition.approve','Approve purchase requisitions',true),
 ('purchase','requisition','reject','organization','purchase.requisition.reject','Reject purchase requisitions',true),
 ('purchase','requisition','cancel','organization','purchase.requisition.cancel','Cancel purchase requisitions',true),
 ('purchase','order','read','organization','purchase.order.read','View purchase orders',true),
 ('purchase','order','create','organization','purchase.order.create','Create purchase orders',true),
 ('purchase','order','update','organization','purchase.order.update','Update purchase orders',true),
 ('purchase','order','workflow','organization','purchase.order.workflow','Change purchase-order lifecycle',true),
 ('purchase','order','submit','organization','purchase.order.submit','Submit purchase orders',true),
 ('purchase','order','approve','organization','purchase.order.approve','Approve purchase orders',true),
 ('purchase','order','reject','organization','purchase.order.reject','Reject purchase orders',true),
 ('purchase','order','cancel','organization','purchase.order.cancel','Cancel purchase orders',true),
 ('purchase','receipt','read','organization','purchase.receipt.read','View purchase receipts',true),
 ('purchase','receipt','create','organization','purchase.receipt.create','Create purchase receipts',true),
 ('purchase','receipt','update','organization','purchase.receipt.update','Update purchase receipts',true),
 ('purchase','receipt','workflow','organization','purchase.receipt.workflow','Change receipt lifecycle',true),
 ('purchase','receipt','complete','organization','purchase.receipt.complete','Complete purchase receipts',true),
 ('purchase','receipt','cancel','organization','purchase.receipt.cancel','Cancel purchase receipts',true)
ON CONFLICT(permission_key) DO NOTHING;
