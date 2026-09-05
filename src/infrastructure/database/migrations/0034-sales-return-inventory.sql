-- Additive Sales Return references for Inventory return movements.
ALTER TABLE sales_returns
  DROP CONSTRAINT IF EXISTS check_sales_return_inventory_status;
ALTER TABLE sales_returns
  ADD CONSTRAINT check_sales_return_inventory_status
  CHECK (inventory_status IN ('NOT_CONNECTED', 'COMPLETED'));

ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS warehouse_id uuid;
ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS item_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_return_warehouse_fk
  ON sales_returns (id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_return_item_id_tenant
  ON sales_return_items (id, tenant_id);

ALTER TABLE sales_returns
  ADD CONSTRAINT fk_sales_return_warehouse_tenant
  FOREIGN KEY (warehouse_id, tenant_id) REFERENCES inventory_warehouses(id, tenant_id);
ALTER TABLE sales_return_items
  ADD CONSTRAINT fk_sales_return_item_item_tenant
  FOREIGN KEY (item_id, tenant_id) REFERENCES inventory_items(id, tenant_id);
