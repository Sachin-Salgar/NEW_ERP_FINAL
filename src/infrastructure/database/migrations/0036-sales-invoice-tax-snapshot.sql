ALTER TABLE sales_invoices
  DROP CONSTRAINT IF EXISTS check_sales_invoice_tax_status;
ALTER TABLE sales_invoices
  ADD COLUMN IF NOT EXISTS taxable_amount numeric(18,4),
  ADD COLUMN IF NOT EXISTS tax_rate numeric(9,4),
  ADD COLUMN IF NOT EXISTS tax_amount numeric(18,4);
ALTER TABLE sales_invoices
  ADD CONSTRAINT check_sales_invoice_tax_status CHECK (tax_status IN ('NOT_CONNECTED','CALCULATED'));
ALTER TABLE sales_invoices
  ADD CONSTRAINT check_sales_invoice_tax_values CHECK (
    (tax_status = 'NOT_CONNECTED' AND tax_reference IS NULL AND tax_amount IS NULL)
    OR (tax_status = 'CALCULATED' AND tax_reference IS NOT NULL AND taxable_amount >= 0 AND tax_rate >= 0 AND tax_amount >= 0)
  );
