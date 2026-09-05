DO $$ BEGIN CREATE TYPE sales_delivery_status_enum AS ENUM ('DRAFT','DISPATCHED','DELIVERED','COMPLETED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sales_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL, branch_id uuid NOT NULL, financial_year_id uuid NOT NULL,
 delivery_number varchar(50) NOT NULL, sales_order_id uuid NOT NULL, customer_id uuid NOT NULL,
 status sales_delivery_status_enum NOT NULL DEFAULT 'DRAFT', idempotency_key varchar(128) NOT NULL,
 notes text, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
 updated_at timestamptz, updated_by uuid, version_number integer NOT NULL DEFAULT 1,
 CONSTRAINT fk_sales_delivery_org_tenant FOREIGN KEY (organization_id,tenant_id) REFERENCES organizations(id,tenant_id),
 CONSTRAINT fk_sales_delivery_branch_tenant FOREIGN KEY (branch_id,tenant_id) REFERENCES branches(id,tenant_id),
 CONSTRAINT fk_sales_delivery_fy_tenant FOREIGN KEY (financial_year_id,tenant_id) REFERENCES financial_years(id,tenant_id),
 CONSTRAINT fk_sales_delivery_customer_tenant FOREIGN KEY (customer_id,tenant_id) REFERENCES customers(id,tenant_id),
 CONSTRAINT fk_sales_delivery_order_context FOREIGN KEY (sales_order_id,organization_id,tenant_id,branch_id,financial_year_id) REFERENCES sales_orders(id,organization_id,tenant_id,branch_id,financial_year_id),
 CONSTRAINT uq_sales_delivery_context_order UNIQUE (sales_order_id,organization_id,tenant_id,branch_id,financial_year_id),
 CONSTRAINT uq_sales_delivery_context_key UNIQUE (idempotency_key,organization_id,tenant_id,branch_id,financial_year_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sales_delivery_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL, branch_id uuid NOT NULL, financial_year_id uuid NOT NULL,
 delivery_id uuid NOT NULL, order_item_id uuid NOT NULL, line_number integer NOT NULL,
 description varchar(500) NOT NULL, quantity numeric(18,4) NOT NULL, unit_of_measure varchar(50) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
 CONSTRAINT fk_sales_delivery_item_context FOREIGN KEY (delivery_id,organization_id,tenant_id,branch_id,financial_year_id) REFERENCES sales_deliveries(id,organization_id,tenant_id,branch_id,financial_year_id) ON DELETE CASCADE,
 CONSTRAINT check_sales_delivery_item_quantity CHECK(quantity>0),
 CONSTRAINT uq_sales_delivery_item_line UNIQUE(delivery_id,line_number)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_delivery_id_tenant ON sales_deliveries(id,tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_delivery_context ON sales_deliveries(id,organization_id,tenant_id,branch_id,financial_year_id);
CREATE INDEX IF NOT EXISTS idx_sales_delivery_list ON sales_deliveries(tenant_id,organization_id,branch_id,financial_year_id,delivery_number);
ALTER TABLE sales_deliveries ENABLE ROW LEVEL SECURITY; ALTER TABLE sales_deliveries FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_delivery_items ENABLE ROW LEVEL SECURITY; ALTER TABLE sales_delivery_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sales_deliveries_tenant_policy ON sales_deliveries;
DROP POLICY IF EXISTS sales_delivery_items_tenant_policy ON sales_delivery_items;
CREATE POLICY sales_deliveries_tenant_policy ON sales_deliveries FOR ALL USING (tenant_id=current_setting('app.current_tenant_id',true)::uuid) WITH CHECK (tenant_id=current_setting('app.current_tenant_id',true)::uuid);
CREATE POLICY sales_delivery_items_tenant_policy ON sales_delivery_items FOR ALL USING (tenant_id=current_setting('app.current_tenant_id',true)::uuid) WITH CHECK (tenant_id=current_setting('app.current_tenant_id',true)::uuid);
