-- Correct the forward migration's warehouse composite-FK target without
-- imposing a false one-order-per-warehouse uniqueness rule.
DROP INDEX IF EXISTS uq_sales_order_warehouse_id_tenant;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_order_warehouse_fk
  ON sales_orders (id, tenant_id);
