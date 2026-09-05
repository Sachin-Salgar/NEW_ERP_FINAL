DO $$ BEGIN CREATE TYPE sales_credit_note_status_enum AS ENUM ('DRAFT','ISSUED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sales_credit_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL, branch_id uuid NOT NULL, financial_year_id uuid NOT NULL,
 credit_note_number varchar(50) NOT NULL, return_id uuid NOT NULL, invoice_id uuid NOT NULL, customer_id uuid NOT NULL,
 status sales_credit_note_status_enum NOT NULL DEFAULT 'DRAFT', idempotency_key varchar(128) NOT NULL,
 finance_status varchar(32) NOT NULL DEFAULT 'NOT_CONNECTED', tax_status varchar(32) NOT NULL DEFAULT 'NOT_CONNECTED', notes text,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_at timestamptz, updated_by uuid, version_number integer NOT NULL DEFAULT 1,
 CONSTRAINT fk_sales_credit_note_org_tenant FOREIGN KEY(organization_id,tenant_id) REFERENCES organizations(id,tenant_id),
 CONSTRAINT fk_sales_credit_note_branch_tenant FOREIGN KEY(branch_id,tenant_id) REFERENCES branches(id,tenant_id),
 CONSTRAINT fk_sales_credit_note_fy_tenant FOREIGN KEY(financial_year_id,tenant_id) REFERENCES financial_years(id,tenant_id),
 CONSTRAINT fk_sales_credit_note_customer_tenant FOREIGN KEY(customer_id,tenant_id) REFERENCES customers(id,tenant_id),
 CONSTRAINT fk_sales_credit_note_return_context FOREIGN KEY(return_id,organization_id,tenant_id,branch_id,financial_year_id) REFERENCES sales_returns(id,organization_id,tenant_id,branch_id,financial_year_id),
 CONSTRAINT fk_sales_credit_note_invoice_context FOREIGN KEY(invoice_id,organization_id,tenant_id,branch_id,financial_year_id) REFERENCES sales_invoices(id,organization_id,tenant_id,branch_id,financial_year_id),
 CONSTRAINT uq_sales_credit_note_return_context UNIQUE(return_id,organization_id,tenant_id,branch_id,financial_year_id),
 CONSTRAINT uq_sales_credit_note_key UNIQUE(idempotency_key,organization_id,tenant_id,branch_id,financial_year_id),
 CONSTRAINT check_sales_credit_note_finance_status CHECK(finance_status='NOT_CONNECTED'),
 CONSTRAINT check_sales_credit_note_tax_status CHECK(tax_status='NOT_CONNECTED')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sales_credit_note_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL, branch_id uuid NOT NULL, financial_year_id uuid NOT NULL,
 credit_note_id uuid NOT NULL, return_item_id uuid NOT NULL, line_number integer NOT NULL,
 description varchar(500) NOT NULL, quantity numeric(18,4) NOT NULL, unit_price numeric(18,4) NOT NULL, unit_of_measure varchar(50) NOT NULL, line_total numeric(18,4) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
 CONSTRAINT fk_sales_credit_note_item_context FOREIGN KEY(credit_note_id,organization_id,tenant_id,branch_id,financial_year_id) REFERENCES sales_credit_notes(id,organization_id,tenant_id,branch_id,financial_year_id) ON DELETE CASCADE,
 CONSTRAINT check_sales_credit_note_item_quantity CHECK(quantity>0), CONSTRAINT check_sales_credit_note_item_price CHECK(unit_price>=0), CONSTRAINT check_sales_credit_note_item_total CHECK(line_total>=0),
 CONSTRAINT uq_sales_credit_note_item_line UNIQUE(credit_note_id,line_number)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_credit_note_id_tenant ON sales_credit_notes(id,tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_credit_note_context ON sales_credit_notes(id,organization_id,tenant_id,branch_id,financial_year_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_credit_note_number ON sales_credit_notes(tenant_id,organization_id,credit_note_number);
CREATE INDEX IF NOT EXISTS idx_sales_credit_note_list ON sales_credit_notes(tenant_id,organization_id,branch_id,financial_year_id,credit_note_number);
ALTER TABLE sales_credit_notes ENABLE ROW LEVEL SECURITY; ALTER TABLE sales_credit_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_credit_note_items ENABLE ROW LEVEL SECURITY; ALTER TABLE sales_credit_note_items FORCE ROW LEVEL SECURITY;
CREATE POLICY sales_credit_notes_tenant_policy ON sales_credit_notes FOR ALL USING(tenant_id=current_setting('app.current_tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.current_tenant_id',true)::uuid);
CREATE POLICY sales_credit_note_items_tenant_policy ON sales_credit_note_items FOR ALL USING(tenant_id=current_setting('app.current_tenant_id',true)::uuid) WITH CHECK(tenant_id=current_setting('app.current_tenant_id',true)::uuid);
