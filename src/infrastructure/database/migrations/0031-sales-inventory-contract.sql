-- Additive Sales/Inventory contract. Historical rows remain nullable.
ALTER TABLE sales_quotation_items ADD COLUMN IF NOT EXISTS item_id uuid;
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS item_id uuid;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS warehouse_id uuid;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS reservation_status varchar(20) NOT NULL DEFAULT 'NOT_RESERVED';

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_quotation_item_id_tenant
  ON sales_quotation_items (id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_order_item_id_tenant
  ON sales_order_items (id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_order_warehouse_id_tenant
  ON sales_orders (warehouse_id, tenant_id)
  WHERE warehouse_id IS NOT NULL;

ALTER TABLE sales_quotation_items
  ADD CONSTRAINT fk_sales_quotation_item_item_tenant
  FOREIGN KEY (item_id, tenant_id) REFERENCES inventory_items(id, tenant_id);
ALTER TABLE sales_order_items
  ADD CONSTRAINT fk_sales_order_item_item_tenant
  FOREIGN KEY (item_id, tenant_id) REFERENCES inventory_items(id, tenant_id);
ALTER TABLE sales_orders
  ADD CONSTRAINT fk_sales_order_warehouse_tenant
  FOREIGN KEY (warehouse_id, tenant_id) REFERENCES inventory_warehouses(id, tenant_id);
ALTER TABLE sales_orders
  ADD CONSTRAINT check_sales_order_reservation_status
  CHECK (reservation_status IN ('NOT_RESERVED', 'RESERVED'));

ALTER TABLE inventory_reservations
  DROP CONSTRAINT IF EXISTS uq_inventory_reservation_source;
ALTER TABLE inventory_reservations
  ADD CONSTRAINT uq_inventory_reservation_source_item
  UNIQUE (tenant_id, organization_id, source_type, source_id, item_id);

CREATE INDEX IF NOT EXISTS idx_sales_order_warehouse
  ON sales_orders (tenant_id, organization_id, warehouse_id);
