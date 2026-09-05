DO $$ BEGIN CREATE TYPE sales_order_status_enum AS ENUM ('DRAFT','CONFIRMED','CANCELLED','CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_quotation_context
 ON sales_quotations(id,organization_id,tenant_id,branch_id,financial_year_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sales_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL, branch_id uuid NOT NULL, financial_year_id uuid NOT NULL,
 order_number varchar(50) NOT NULL, customer_id uuid NOT NULL, quotation_id uuid NOT NULL,
 status sales_order_status_enum NOT NULL DEFAULT 'DRAFT', notes text,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_at timestamptz, updated_by uuid,
 deleted_at timestamptz, deleted_by uuid, is_deleted boolean NOT NULL DEFAULT false, version_number integer NOT NULL DEFAULT 1,
 CONSTRAINT fk_sales_order_org_tenant FOREIGN KEY (organization_id,tenant_id) REFERENCES organizations(id,tenant_id),
 CONSTRAINT fk_sales_order_branch_tenant FOREIGN KEY (branch_id,tenant_id) REFERENCES branches(id,tenant_id),
 CONSTRAINT fk_sales_order_fy_tenant FOREIGN KEY (financial_year_id,tenant_id) REFERENCES financial_years(id,tenant_id),
 CONSTRAINT fk_sales_order_customer_tenant FOREIGN KEY (customer_id,tenant_id) REFERENCES customers(id,tenant_id),
 CONSTRAINT fk_sales_order_quotation_context FOREIGN KEY (quotation_id,organization_id,tenant_id,branch_id,financial_year_id) REFERENCES sales_quotations(id,organization_id,tenant_id,branch_id,financial_year_id),
 CONSTRAINT check_sales_order_soft_delete CHECK ((is_deleted=false AND deleted_at IS NULL) OR (is_deleted=true AND deleted_at IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_order_id_tenant ON sales_orders(id,tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_order_number ON sales_orders(tenant_id,organization_id,order_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_order_context ON sales_orders(id,organization_id,tenant_id,branch_id,financial_year_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_list ON sales_orders(tenant_id,organization_id,order_number,id) WHERE is_deleted=false;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sales_order_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL, branch_id uuid NOT NULL, financial_year_id uuid NOT NULL, order_id uuid NOT NULL,
 line_number integer NOT NULL, description varchar(500) NOT NULL, quantity numeric(18,4) NOT NULL, unit_price numeric(18,4) NOT NULL, unit_of_measure varchar(50) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_at timestamptz, updated_by uuid, version_number integer NOT NULL DEFAULT 1,
 CONSTRAINT fk_sales_order_item_order_context FOREIGN KEY (order_id,organization_id,tenant_id,branch_id,financial_year_id) REFERENCES sales_orders(id,organization_id,tenant_id,branch_id,financial_year_id) ON DELETE CASCADE,
 CONSTRAINT fk_sales_order_item_branch_tenant FOREIGN KEY (branch_id,tenant_id) REFERENCES branches(id,tenant_id),
 CONSTRAINT fk_sales_order_item_fy_tenant FOREIGN KEY (financial_year_id,tenant_id) REFERENCES financial_years(id,tenant_id),
 CONSTRAINT check_sales_order_item_quantity CHECK(quantity>0), CONSTRAINT check_sales_order_item_price CHECK(unit_price>=0),
 CONSTRAINT uq_sales_order_item_line UNIQUE(order_id,line_number)
);
--> statement-breakpoint
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY; ALTER TABLE sales_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY; ALTER TABLE sales_order_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sales_orders_tenant_policy ON sales_orders;
DROP POLICY IF EXISTS sales_order_items_tenant_policy ON sales_order_items;
CREATE POLICY sales_orders_tenant_policy ON sales_orders FOR ALL USING (tenant_id=current_setting('app.current_tenant_id',true)::uuid) WITH CHECK (tenant_id=current_setting('app.current_tenant_id',true)::uuid);
CREATE POLICY sales_order_items_tenant_policy ON sales_order_items FOR ALL USING (tenant_id=current_setting('app.current_tenant_id',true)::uuid) WITH CHECK (tenant_id=current_setting('app.current_tenant_id',true)::uuid);
