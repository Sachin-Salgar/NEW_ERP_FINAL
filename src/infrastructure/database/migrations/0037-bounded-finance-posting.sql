CREATE TABLE IF NOT EXISTS finance_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  financial_year_id uuid NOT NULL,
  document_type varchar(32) NOT NULL,
  document_id uuid NOT NULL,
  reference varchar(255) NOT NULL,
  amount numeric(18,4) NOT NULL,
  idempotency_key varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT fk_finance_posting_org FOREIGN KEY (organization_id,tenant_id) REFERENCES organizations(id,tenant_id),
  CONSTRAINT fk_finance_posting_branch FOREIGN KEY (branch_id,tenant_id) REFERENCES branches(id,tenant_id),
  CONSTRAINT fk_finance_posting_fy FOREIGN KEY (financial_year_id,tenant_id) REFERENCES financial_years(id,tenant_id),
  CONSTRAINT check_finance_posting_type CHECK (document_type IN ('INVOICE','CREDIT_NOTE')),
  CONSTRAINT check_finance_posting_amount CHECK (amount >= 0),
  CONSTRAINT uq_finance_posting_key UNIQUE (tenant_id,organization_id,branch_id,financial_year_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_finance_posting_document ON finance_postings(tenant_id,organization_id,document_type,document_id);
ALTER TABLE finance_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_postings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS finance_postings_tenant_policy ON finance_postings;
CREATE POLICY finance_postings_tenant_policy ON finance_postings FOR ALL USING (tenant_id=current_setting('app.current_tenant_id',true)::uuid) WITH CHECK (tenant_id=current_setting('app.current_tenant_id',true)::uuid);

ALTER TABLE sales_invoices DROP CONSTRAINT IF EXISTS check_sales_invoice_finance_status;
ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS finance_reference varchar(255);
ALTER TABLE sales_invoices ADD CONSTRAINT check_sales_invoice_finance_status CHECK (finance_status IN ('NOT_CONNECTED','POSTED'));
ALTER TABLE sales_credit_notes DROP CONSTRAINT IF EXISTS check_sales_credit_note_finance_status;
ALTER TABLE sales_credit_notes ADD COLUMN IF NOT EXISTS finance_reference varchar(255);
ALTER TABLE sales_credit_notes ADD CONSTRAINT check_sales_credit_note_finance_status CHECK (finance_status IN ('NOT_CONNECTED','POSTED'));
