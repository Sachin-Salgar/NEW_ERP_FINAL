CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_quotation_org_tenant
  ON sales_quotations (id, organization_id, tenant_id);
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'fk_sales_quote_item_quote_org_tenant'
       AND conrelid = 'sales_quotation_items'::regclass
  ) THEN
    ALTER TABLE sales_quotation_items
      ADD CONSTRAINT fk_sales_quote_item_quote_org_tenant
      FOREIGN KEY (quotation_id, organization_id, tenant_id)
      REFERENCES sales_quotations (id, organization_id, tenant_id)
      ON DELETE CASCADE;
  END IF;
END $$;
