DO $$ BEGIN CREATE TYPE sales_return_status_enum AS ENUM ('REQUESTED','INSPECTED','APPROVED','PROCESSED','CLOSED','REJECTED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sales_returns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL, branch_id uuid NOT NULL, financial_year_id uuid NOT NULL,
 return_number varchar(50) NOT NULL, invoice_id uuid NOT NULL, delivery_id uuid NOT NULL, customer_id uuid NOT NULL,
 status sales_return_status_enum NOT NULL DEFAULT 'REQUESTED', idempotency_key varchar(128) NOT NULL,
 inventory_status varchar(32) NOT NULL DEFAULT 'NOT_CONNECTED', finance_status varchar(32) NOT NULL DEFAULT 'NOT_CONNECTED', notes text,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_at timestamptz, updated_by uuid, version_number integer NOT NULL DEFAULT 1,
 CONSTRAINT fk_sales_return_org_tenant FOREIGN KEY (organization_id,tenant_id) REFERENCES organizations(id,tenant_id),
 CONSTRAINT fk_sales_return_branch_tenant FOREIGN KEY (branch_id,tenant_id) REFERENCES branches(id,tenant_id),
 CONSTRAINT fk_sales_return_fy_tenant FOREIGN KEY (financial_year_id,tenant_id) REFERENCES financial_years(id,tenant_id),
 CONSTRAINT fk_sales_return_customer_tenant FOREIGN KEY (customer_id,tenant_id) REFERENCES customers(id,tenant_id),
 CONSTRAINT fk_sales_return_invoice_context FOREIGN KEY (invoice_id,organization_id,tenant_id,branch_id,financial_year_id) REFERENCES sales_invoices(id,organization_id,tenant_id,branch_id,financial_year_id),
 CONSTRAINT fk_sales_return_delivery_context FOREIGN KEY (delivery_id,organization_id,tenant_id,branch_id,financial_year_id) REFERENCES sales_deliveries(id,organization_id,tenant_id,branch_id,financial_year_id),
 CONSTRAINT uq_sales_return_invoice_context UNIQUE(invoice_id,organization_id,tenant_id,branch_id,financial_year_id),
 CONSTRAINT uq_sales_return_key UNIQUE(idempotency_key,organization_id,tenant_id,branch_id,financial_year_id),
 CONSTRAINT check_sales_return_inventory_status CHECK(inventory_status='NOT_CONNECTED'),
 CONSTRAINT check_sales_return_finance_status CHECK(finance_status='NOT_CONNECTED')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sales_return_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL, branch_id uuid NOT NULL, financial_year_id uuid NOT NULL,
 return_id uuid NOT NULL, invoice_item_id uuid NOT NULL, line_number integer NOT NULL,
 description varchar(500) NOT NULL, quantity numeric(18,4) NOT NULL, unit_price numeric(18,4) NOT NULL, unit_of_measure varchar(50) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
 CONSTRAINT fk_sales_return_item_context FOREIGN KEY(return_id,organization_id,tenant_id,branch_id,financial_year_id) REFERENCES sales_returns(id,organization_id,tenant_id,branch_id,financial_year_id) ON DELETE CASCADE,
 CONSTRAINT check_sales_return_item_quantity CHECK(quantity>0), CONSTRAINT check_sales_return_item_price CHECK(unit_price>=0),
 CONSTRAINT uq_sales_return_item_line UNIQUE(return_id,line_number)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_return_id_tenant ON sales_returns(id,tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_return_context ON sales_returns(id,organization_id,tenant_id,branch_id,financial_year_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_return_number ON sales_returns(tenant_id,organization_id,return_number);
CREATE INDEX IF NOT EXISTS idx_sales_return_list ON sales_returns(tenant_id,organization_id,branch_id,financial_year_id,return_number);
ALTER TABLE sales_returns ENABLE ROW LEVEL SECURITY; ALTER TABLE sales_returns FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_return_items ENABLE ROW LEVEL SECURITY; ALTER TABLE sales_return_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sales_returns_tenant_policy ON sales_returns;
DROP POLICY IF EXISTS sales_return_items_tenant_policy ON sales_return_items;
CREATE POLICY sales_returns_tenant_policy ON sales_returns FOR ALL USING (tenant_id=current_setting('app.current_tenant_id',true)::uuid) WITH CHECK (tenant_id=current_setting('app.current_tenant_id',true)::uuid);
CREATE POLICY sales_return_items_tenant_policy ON sales_return_items FOR ALL USING (tenant_id=current_setting('app.current_tenant_id',true)::uuid) WITH CHECK (tenant_id=current_setting('app.current_tenant_id',true)::uuid);
