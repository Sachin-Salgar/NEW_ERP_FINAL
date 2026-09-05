CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_item_id_tenant
  ON inventory_items (id, tenant_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS inventory_warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  code varchar(100) NOT NULL,
  name varchar(255) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT fk_inventory_warehouse_org_tenant FOREIGN KEY (organization_id, tenant_id)
    REFERENCES organizations(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT check_inventory_warehouse_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT uq_inventory_warehouse_code UNIQUE (tenant_id, organization_id, code)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_warehouse_id_tenant
  ON inventory_warehouses (id, tenant_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS inventory_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  item_id uuid NOT NULL,
  on_hand_quantity numeric(18,4) NOT NULL DEFAULT 0,
  reserved_quantity numeric(18,4) NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  CONSTRAINT fk_inventory_stock_org_tenant FOREIGN KEY (organization_id, tenant_id)
    REFERENCES organizations(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_stock_warehouse FOREIGN KEY (warehouse_id, tenant_id)
    REFERENCES inventory_warehouses(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_stock_item FOREIGN KEY (item_id, tenant_id)
    REFERENCES inventory_items(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT uq_inventory_stock_scope UNIQUE (tenant_id, organization_id, warehouse_id, item_id),
  CONSTRAINT check_inventory_stock_nonnegative CHECK (
    on_hand_quantity >= 0 AND reserved_quantity >= 0 AND reserved_quantity <= on_hand_quantity
  )
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  financial_year_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  item_id uuid NOT NULL,
  source_type varchar(80) NOT NULL,
  source_id uuid NOT NULL,
  idempotency_key varchar(128) NOT NULL,
  quantity numeric(18,4) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'RESERVED',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  CONSTRAINT fk_inventory_reservation_org_tenant FOREIGN KEY (organization_id, tenant_id)
    REFERENCES organizations(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_reservation_branch FOREIGN KEY (branch_id, tenant_id)
    REFERENCES branches(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_reservation_fy FOREIGN KEY (financial_year_id, tenant_id)
    REFERENCES financial_years(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_reservation_warehouse FOREIGN KEY (warehouse_id, tenant_id)
    REFERENCES inventory_warehouses(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_reservation_item FOREIGN KEY (item_id, tenant_id)
    REFERENCES inventory_items(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT check_inventory_reservation_quantity CHECK (quantity > 0),
  CONSTRAINT check_inventory_reservation_status CHECK (status IN ('RESERVED', 'RELEASED', 'FULFILLED')),
  CONSTRAINT uq_inventory_reservation_source UNIQUE (tenant_id, organization_id, source_type, source_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  financial_year_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  item_id uuid NOT NULL,
  movement_type varchar(20) NOT NULL,
  quantity numeric(18,4) NOT NULL,
  source_type varchar(80) NOT NULL,
  source_id uuid NOT NULL,
  operation_key varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT fk_inventory_movement_org_tenant FOREIGN KEY (organization_id, tenant_id)
    REFERENCES organizations(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_movement_branch FOREIGN KEY (branch_id, tenant_id)
    REFERENCES branches(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_movement_fy FOREIGN KEY (financial_year_id, tenant_id)
    REFERENCES financial_years(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_movement_warehouse FOREIGN KEY (warehouse_id, tenant_id)
    REFERENCES inventory_warehouses(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_movement_item FOREIGN KEY (item_id, tenant_id)
    REFERENCES inventory_items(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT check_inventory_movement_type CHECK (movement_type IN ('RECEIPT', 'ISSUE', 'RETURN')),
  CONSTRAINT check_inventory_movement_quantity CHECK (quantity > 0),
  CONSTRAINT uq_inventory_movement_operation UNIQUE (tenant_id, organization_id, operation_key)
);
--> statement-breakpoint
CREATE INDEX idx_inventory_warehouse_org_name ON inventory_warehouses (tenant_id, organization_id, name);
--> statement-breakpoint
CREATE INDEX idx_inventory_stock_org_warehouse ON inventory_stock (tenant_id, organization_id, warehouse_id, item_id);
--> statement-breakpoint
CREATE INDEX idx_inventory_reservation_org_status ON inventory_reservations (tenant_id, organization_id, status, created_at);
--> statement-breakpoint
CREATE INDEX idx_inventory_movement_org_item ON inventory_movements (tenant_id, organization_id, item_id, created_at);
--> statement-breakpoint
ALTER TABLE inventory_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_warehouses FORCE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock FORCE ROW LEVEL SECURITY;
ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_reservations FORCE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS inventory_warehouses_tenant_isolation ON inventory_warehouses;
CREATE POLICY inventory_warehouses_tenant_isolation ON inventory_warehouses
  AS PERMISSIVE FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
DROP POLICY IF EXISTS inventory_stock_tenant_isolation ON inventory_stock;
CREATE POLICY inventory_stock_tenant_isolation ON inventory_stock
  AS PERMISSIVE FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
DROP POLICY IF EXISTS inventory_reservations_tenant_isolation ON inventory_reservations;
CREATE POLICY inventory_reservations_tenant_isolation ON inventory_reservations
  AS PERMISSIVE FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
DROP POLICY IF EXISTS inventory_movements_tenant_isolation ON inventory_movements;
CREATE POLICY inventory_movements_tenant_isolation ON inventory_movements
  AS PERMISSIVE FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
