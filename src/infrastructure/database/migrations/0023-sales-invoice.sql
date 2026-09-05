DO $$ BEGIN CREATE TYPE sales_invoice_status_enum AS ENUM ('DRAFT','ISSUED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sales_invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL, branch_id uuid NOT NULL, financial_year_id uuid NOT NULL,
 invoice_number varchar(50) NOT NULL, sales_order_id uuid NOT NULL, delivery_id uuid NOT NULL, customer_id uuid NOT NULL,
 status sales_invoice_status_enum NOT NULL DEFAULT 'DRAFT', idempotency_key varchar(128) NOT NULL,
 finance_status varchar(32) NOT NULL DEFAULT 'NOT_CONNECTED', tax_status varchar(32) NOT NULL DEFAULT 'NOT_CONNECTED',
 finance_reference varchar(255), tax_reference varchar(255), notes text,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_at timestamptz, updated_by uuid,
 version_number integer NOT NULL DEFAULT 1,
 CONSTRAINT fk_sales_invoice_org_tenant FOREIGN KEY (organization_id,tenant_id) REFERENCES organizations(id,tenant_id),
 CONSTRAINT fk_sales_invoice_branch_tenant FOREIGN KEY (branch_id,tenant_id) REFERENCES branches(id,tenant_id),
 CONSTRAINT fk_sales_invoice_fy_tenant FOREIGN KEY (financial_year_id,tenant_id) REFERENCES financial_years(id,tenant_id),
 CONSTRAINT fk_sales_invoice_customer_tenant FOREIGN KEY (customer_id,tenant_id) REFERENCES customers(id,tenant_id),
 CONSTRAINT fk_sales_invoice_delivery_context FOREIGN KEY (delivery_id,organization_id,tenant_id,branch_id,financial_year_id) REFERENCES sales_deliveries(id,organization_id,tenant_id,branch_id,financial_year_id),
 CONSTRAINT uq_sales_invoice_delivery_context UNIQUE (delivery_id,organization_id,tenant_id,branch_id,financial_year_id),
 CONSTRAINT uq_sales_invoice_key UNIQUE (idempotency_key,organization_id,tenant_id,branch_id,financial_year_id),
 CONSTRAINT check_sales_invoice_finance_status CHECK (finance_status='NOT_CONNECTED'),
 CONSTRAINT check_sales_invoice_tax_status CHECK (tax_status='NOT_CONNECTED')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sales_invoice_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL, branch_id uuid NOT NULL, financial_year_id uuid NOT NULL,
 invoice_id uuid NOT NULL, delivery_item_id uuid NOT NULL, line_number integer NOT NULL,
 description varchar(500) NOT NULL, quantity numeric(18,4) NOT NULL, unit_price numeric(18,4) NOT NULL,
 unit_of_measure varchar(50) NOT NULL, line_total numeric(18,4) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
 CONSTRAINT fk_sales_invoice_item_context FOREIGN KEY (invoice_id,organization_id,tenant_id,branch_id,financial_year_id) REFERENCES sales_invoices(id,organization_id,tenant_id,branch_id,financial_year_id) ON DELETE CASCADE,
 CONSTRAINT check_sales_invoice_item_quantity CHECK(quantity>0), CONSTRAINT check_sales_invoice_item_price CHECK(unit_price>=0),
 CONSTRAINT check_sales_invoice_item_total CHECK(line_total>=0), CONSTRAINT uq_sales_invoice_item_line UNIQUE(invoice_id,line_number)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_invoice_id_tenant ON sales_invoices(id,tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_invoice_context ON sales_invoices(id,organization_id,tenant_id,branch_id,financial_year_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_invoice_number ON sales_invoices(tenant_id,organization_id,invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_list ON sales_invoices(tenant_id,organization_id,branch_id,financial_year_id,invoice_number);
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY; ALTER TABLE sales_invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice_items ENABLE ROW LEVEL SECURITY; ALTER TABLE sales_invoice_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sales_invoices_tenant_policy ON sales_invoices;
DROP POLICY IF EXISTS sales_invoice_items_tenant_policy ON sales_invoice_items;
CREATE POLICY sales_invoices_tenant_policy ON sales_invoices FOR ALL USING (tenant_id=current_setting('app.current_tenant_id',true)::uuid) WITH CHECK (tenant_id=current_setting('app.current_tenant_id',true)::uuid);
CREATE POLICY sales_invoice_items_tenant_policy ON sales_invoice_items FOR ALL USING (tenant_id=current_setting('app.current_tenant_id',true)::uuid) WITH CHECK (tenant_id=current_setting('app.current_tenant_id',true)::uuid);
