CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  code varchar(100) NOT NULL,
  name varchar(255) NOT NULL,
  description text,
  unit_of_measure varchar(50) NOT NULL,
  sales_eligible boolean NOT NULL DEFAULT true,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT fk_inventory_item_org_tenant FOREIGN KEY (organization_id, tenant_id)
    REFERENCES organizations(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT check_inventory_item_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT check_inventory_item_soft_delete CHECK (
    (is_deleted = false AND deleted_at IS NULL) OR (is_deleted = true AND deleted_at IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_item_org_code
  ON inventory_items (tenant_id, organization_id, code) WHERE is_deleted = false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_inventory_item_org_name
  ON inventory_items (tenant_id, organization_id, name, id) WHERE is_deleted = false;
--> statement-breakpoint
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE inventory_items FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS inventory_items_tenant_isolation_policy ON inventory_items;
--> statement-breakpoint
CREATE POLICY inventory_items_tenant_isolation_policy ON inventory_items
  AS PERMISSIVE FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
