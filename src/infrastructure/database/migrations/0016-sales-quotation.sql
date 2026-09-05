DO $$ BEGIN
  CREATE TYPE quotation_status_enum AS ENUM ('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED','CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sales_quotations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL, quotation_number varchar(50) NOT NULL, customer_id uuid NOT NULL,
 quotation_date date NOT NULL, valid_until date NOT NULL, status quotation_status_enum NOT NULL DEFAULT 'DRAFT', notes text,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_at timestamptz, updated_by uuid,
 deleted_at timestamptz, deleted_by uuid, is_deleted boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1,
 CONSTRAINT fk_sales_quotation_org_tenant FOREIGN KEY (organization_id,tenant_id) REFERENCES organizations(id,tenant_id),
 CONSTRAINT fk_sales_quotation_customer_tenant FOREIGN KEY (customer_id,tenant_id) REFERENCES customers(id,tenant_id),
 CONSTRAINT check_sales_quotation_dates CHECK (valid_until >= quotation_date),
 CONSTRAINT check_sales_quotation_soft_delete CHECK ((is_deleted=false AND deleted_at IS NULL) OR (is_deleted=true AND deleted_at IS NOT NULL)
 ));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_quotation_id_tenant ON sales_quotations(id,tenant_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_quotation_number ON sales_quotations(tenant_id,organization_id,quotation_number);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sales_quotation_list ON sales_quotations(tenant_id,organization_id,quotation_number,id) WHERE is_deleted=false;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sales_quotation_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL, quotation_id uuid NOT NULL, line_number integer NOT NULL, description varchar(500) NOT NULL,
 quantity numeric(18,4) NOT NULL, unit_price numeric(18,4) NOT NULL, unit_of_measure varchar(50) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
 CONSTRAINT fk_sales_quote_item_quote FOREIGN KEY (quotation_id,tenant_id) REFERENCES sales_quotations(id,tenant_id) ON DELETE CASCADE,
 CONSTRAINT fk_sales_quote_item_org_tenant FOREIGN KEY (organization_id,tenant_id) REFERENCES organizations(id,tenant_id),
 CONSTRAINT check_sales_quote_item_quantity CHECK (quantity > 0), CONSTRAINT check_sales_quote_item_price CHECK (unit_price >= 0),
 CONSTRAINT uq_sales_quote_item_line UNIQUE (quotation_id,line_number)
);
--> statement-breakpoint
ALTER TABLE sales_quotations ENABLE ROW LEVEL SECURITY; ALTER TABLE sales_quotations FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_quotation_items ENABLE ROW LEVEL SECURITY; ALTER TABLE sales_quotation_items FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS sales_quotations_tenant_policy ON sales_quotations;
DROP POLICY IF EXISTS sales_quotation_items_tenant_policy ON sales_quotation_items;
CREATE POLICY sales_quotations_tenant_policy ON sales_quotations FOR ALL USING (tenant_id=current_setting('app.current_tenant_id',true)::uuid) WITH CHECK (tenant_id=current_setting('app.current_tenant_id',true)::uuid);
CREATE POLICY sales_quotation_items_tenant_policy ON sales_quotation_items FOR ALL USING (tenant_id=current_setting('app.current_tenant_id',true)::uuid) WITH CHECK (tenant_id=current_setting('app.current_tenant_id',true)::uuid);
