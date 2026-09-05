CREATE TABLE IF NOT EXISTS procurement_suppliers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL, code varchar(50) NOT NULL, name varchar(255) NOT NULL, email varchar(255),
 status varchar(20) NOT NULL DEFAULT 'ACTIVE', created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
 CONSTRAINT uq_procurement_supplier_code UNIQUE(tenant_id,organization_id,code),
 CONSTRAINT fk_procurement_supplier_org FOREIGN KEY(organization_id,tenant_id) REFERENCES organizations(id,tenant_id)
);
CREATE TABLE IF NOT EXISTS procurement_requisitions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL, branch_id uuid NOT NULL, financial_year_id uuid NOT NULL,
 requisition_number varchar(50) NOT NULL DEFAULT ('PR-'||substr(gen_random_uuid()::text,1,8)), required_date date NOT NULL,
 justification text, status varchar(20) NOT NULL DEFAULT 'DRAFT', created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
 CONSTRAINT uq_procurement_requisition_number UNIQUE(tenant_id,organization_id,requisition_number)
);
CREATE TABLE IF NOT EXISTS procurement_requisition_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, organization_id uuid NOT NULL, requisition_id uuid NOT NULL,
 line_number integer NOT NULL, item_id uuid NOT NULL, description varchar(500) NOT NULL, quantity numeric(18,4) NOT NULL,
 unit_price numeric(18,4) NOT NULL DEFAULT 0, unit_of_measure varchar(50) NOT NULL,
 CONSTRAINT fk_procurement_requisition_line FOREIGN KEY(requisition_id) REFERENCES procurement_requisitions(id) ON DELETE CASCADE,
 CONSTRAINT check_procurement_requisition_qty CHECK(quantity > 0), CONSTRAINT uq_procurement_requisition_line UNIQUE(requisition_id,line_number)
);
CREATE TABLE IF NOT EXISTS procurement_purchase_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL, branch_id uuid NOT NULL, financial_year_id uuid NOT NULL, supplier_id uuid NOT NULL,
 requisition_id uuid, po_number varchar(50) NOT NULL DEFAULT ('PO-'||substr(gen_random_uuid()::text,1,8)), order_date date NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'DRAFT', created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
 CONSTRAINT uq_procurement_po_number UNIQUE(tenant_id,organization_id,po_number),
 CONSTRAINT fk_procurement_po_supplier FOREIGN KEY(supplier_id) REFERENCES procurement_suppliers(id),
 CONSTRAINT fk_procurement_po_requisition FOREIGN KEY(requisition_id) REFERENCES procurement_requisitions(id)
);
CREATE TABLE IF NOT EXISTS procurement_purchase_order_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, organization_id uuid NOT NULL, purchase_order_id uuid NOT NULL,
 line_number integer NOT NULL, item_id uuid NOT NULL, description varchar(500) NOT NULL, quantity numeric(18,4) NOT NULL,
 unit_price numeric(18,4) NOT NULL DEFAULT 0, unit_of_measure varchar(50) NOT NULL,
 CONSTRAINT fk_procurement_po_line FOREIGN KEY(purchase_order_id) REFERENCES procurement_purchase_orders(id) ON DELETE CASCADE,
 CONSTRAINT check_procurement_po_qty CHECK(quantity > 0), CONSTRAINT uq_procurement_po_line UNIQUE(purchase_order_id,line_number)
);
CREATE TABLE IF NOT EXISTS procurement_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL, branch_id uuid NOT NULL, financial_year_id uuid NOT NULL, purchase_order_id uuid NOT NULL,
 warehouse_id uuid NOT NULL, receipt_date date NOT NULL, operation_key varchar(128) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
 CONSTRAINT uq_procurement_receipt_operation UNIQUE(tenant_id,operation_key)
);
CREATE TABLE IF NOT EXISTS procurement_receipt_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, organization_id uuid NOT NULL, receipt_id uuid NOT NULL,
 item_id uuid NOT NULL, quantity numeric(18,4) NOT NULL, CONSTRAINT fk_procurement_receipt_line FOREIGN KEY(receipt_id) REFERENCES procurement_receipts(id) ON DELETE CASCADE,
 CONSTRAINT check_procurement_receipt_qty CHECK(quantity > 0), CONSTRAINT uq_procurement_receipt_item UNIQUE(receipt_id,item_id)
);
ALTER TABLE procurement_suppliers ENABLE ROW LEVEL SECURITY; ALTER TABLE procurement_suppliers FORCE ROW LEVEL SECURITY;
ALTER TABLE procurement_requisitions ENABLE ROW LEVEL SECURITY; ALTER TABLE procurement_requisitions FORCE ROW LEVEL SECURITY;
ALTER TABLE procurement_requisition_lines ENABLE ROW LEVEL SECURITY; ALTER TABLE procurement_requisition_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE procurement_purchase_orders ENABLE ROW LEVEL SECURITY; ALTER TABLE procurement_purchase_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE procurement_purchase_order_lines ENABLE ROW LEVEL SECURITY; ALTER TABLE procurement_purchase_order_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE procurement_receipts ENABLE ROW LEVEL SECURITY; ALTER TABLE procurement_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE procurement_receipt_lines ENABLE ROW LEVEL SECURITY; ALTER TABLE procurement_receipt_lines FORCE ROW LEVEL SECURITY;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['procurement_suppliers','procurement_requisitions','procurement_requisition_lines','procurement_purchase_orders','procurement_purchase_order_lines','procurement_receipts','procurement_receipt_lines'] LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_tenant_policy',t); EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (tenant_id=current_setting(''app.current_tenant_id'',true)::uuid) WITH CHECK (tenant_id=current_setting(''app.current_tenant_id'',true)::uuid)', t||'_tenant_policy',t); END LOOP; END $$;
