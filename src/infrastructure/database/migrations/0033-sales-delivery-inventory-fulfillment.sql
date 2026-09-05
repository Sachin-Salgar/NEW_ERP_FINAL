-- Additive Sales Delivery references for Inventory fulfillment.
ALTER TABLE sales_deliveries ADD COLUMN IF NOT EXISTS warehouse_id uuid;
ALTER TABLE sales_delivery_items ADD COLUMN IF NOT EXISTS item_id uuid;
ALTER TABLE sales_delivery_items ADD COLUMN IF NOT EXISTS reservation_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_delivery_item_id_tenant
  ON sales_delivery_items (id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_reservation_id_tenant
  ON inventory_reservations (id, tenant_id);

ALTER TABLE sales_deliveries
  ADD CONSTRAINT fk_sales_delivery_warehouse_tenant
  FOREIGN KEY (warehouse_id, tenant_id) REFERENCES inventory_warehouses(id, tenant_id);
ALTER TABLE sales_delivery_items
  ADD CONSTRAINT fk_sales_delivery_item_item_tenant
  FOREIGN KEY (item_id, tenant_id) REFERENCES inventory_items(id, tenant_id);
ALTER TABLE sales_delivery_items
  ADD CONSTRAINT fk_sales_delivery_item_reservation_tenant
  FOREIGN KEY (reservation_id, tenant_id) REFERENCES inventory_reservations(id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_delivery_item_reservation
  ON sales_delivery_items (reservation_id, tenant_id)
  WHERE reservation_id IS NOT NULL;
