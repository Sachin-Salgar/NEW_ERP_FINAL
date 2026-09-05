DO $$ BEGIN CREATE TYPE sales_price_list_status_enum AS ENUM ('DRAFT','PUBLISHED','ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sales_price_lists (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, organization_id uuid NOT NULL, branch_id uuid NULL,
 code varchar(64) NOT NULL, name varchar(200) NOT NULL, currency varchar(3) NOT NULL, effective_from date NOT NULL, effective_to date NULL,
 status sales_price_list_status_enum NOT NULL DEFAULT 'DRAFT', version_number integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_at timestamptz, updated_by uuid,
 CONSTRAINT fk_sales_price_list_org FOREIGN KEY(organization_id,tenant_id) REFERENCES organizations(id,tenant_id), CONSTRAINT fk_sales_price_list_branch FOREIGN KEY(branch_id,tenant_id) REFERENCES branches(id,tenant_id),
 CONSTRAINT uq_sales_price_list_code UNIQUE(tenant_id,organization_id,code), CONSTRAINT check_sales_price_list_dates CHECK(effective_to IS NULL OR effective_to>=effective_from)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sales_price_list_scope ON sales_price_lists(tenant_id,organization_id,branch_id,status,effective_from);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_price_list_context ON sales_price_lists(id,organization_id,tenant_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sales_price_list_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL, price_list_id uuid NOT NULL, item_code varchar(128) NOT NULL, unit_of_measure varchar(50) NOT NULL,
 price numeric(18,4) NOT NULL, effective_from date NOT NULL, effective_to date NULL, version_number integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_at timestamptz, updated_by uuid,
 CONSTRAINT fk_sales_price_item_list FOREIGN KEY(price_list_id,organization_id,tenant_id) REFERENCES sales_price_lists(id,organization_id,tenant_id) ON DELETE CASCADE,
 CONSTRAINT uq_sales_price_item_period UNIQUE(tenant_id,price_list_id,item_code,unit_of_measure,effective_from),
 CONSTRAINT check_sales_price_item_price CHECK(price>=0), CONSTRAINT check_sales_price_item_dates CHECK(effective_to IS NULL OR effective_to>=effective_from)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sales_price_item_lookup ON sales_price_list_items(tenant_id,organization_id,item_code,unit_of_measure,effective_from);
ALTER TABLE sales_price_lists ENABLE ROW LEVEL SECURITY; ALTER TABLE sales_price_lists FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_price_list_items ENABLE ROW LEVEL SECURITY; ALTER TABLE sales_price_list_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sales_price_lists_tenant_policy ON sales_price_lists;
CREATE POLICY sales_price_lists_tenant_policy ON sales_price_lists FOR ALL USING(tenant_id=current_setting('app.current_tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.current_tenant_id',true)::uuid);
DROP POLICY IF EXISTS sales_price_list_items_tenant_policy ON sales_price_list_items;
CREATE POLICY sales_price_list_items_tenant_policy ON sales_price_list_items FOR ALL USING(tenant_id=current_setting('app.current_tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.current_tenant_id',true)::uuid);
