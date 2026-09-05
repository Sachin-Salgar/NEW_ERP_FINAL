ALTER TABLE sales_quotations
  ADD COLUMN IF NOT EXISTS branch_id uuid,
  ADD COLUMN IF NOT EXISTS financial_year_id uuid;
--> statement-breakpoint

UPDATE sales_quotations AS quotation
   SET branch_id = branch.id
  FROM branches AS branch
 WHERE quotation.branch_id IS NULL
   AND branch.tenant_id = quotation.tenant_id
   AND branch.organization_id = quotation.organization_id
   AND branch.is_default = true
   AND branch.is_deleted = false
   AND branch.status = 'active';
--> statement-breakpoint

UPDATE sales_quotations AS quotation
   SET financial_year_id = financial_year.id
  FROM financial_years AS financial_year
 WHERE quotation.financial_year_id IS NULL
   AND financial_year.tenant_id = quotation.tenant_id
   AND financial_year.organization_id = quotation.organization_id
   AND financial_year.is_active = true
   AND financial_year.status = 'open'
   AND financial_year.is_locked = false
   AND financial_year.is_deleted = false;
--> statement-breakpoint

ALTER TABLE sales_quotation_items
  ADD COLUMN IF NOT EXISTS branch_id uuid,
  ADD COLUMN IF NOT EXISTS financial_year_id uuid;
--> statement-breakpoint

UPDATE sales_quotation_items AS item
   SET branch_id = quotation.branch_id,
       financial_year_id = quotation.financial_year_id
  FROM sales_quotations AS quotation
 WHERE item.quotation_id = quotation.id
   AND item.tenant_id = quotation.tenant_id
   AND (item.branch_id IS NULL OR item.financial_year_id IS NULL);
--> statement-breakpoint

ALTER TABLE sales_quotations
  ADD CONSTRAINT fk_sales_quotation_branch_tenant
    FOREIGN KEY (branch_id, tenant_id) REFERENCES branches(id, tenant_id),
  ADD CONSTRAINT fk_sales_quotation_financial_year_tenant
    FOREIGN KEY (financial_year_id, tenant_id) REFERENCES financial_years(id, tenant_id);
--> statement-breakpoint

ALTER TABLE sales_quotation_items
  ADD CONSTRAINT fk_sales_quotation_item_branch_tenant
    FOREIGN KEY (branch_id, tenant_id) REFERENCES branches(id, tenant_id),
  ADD CONSTRAINT fk_sales_quotation_item_financial_year_tenant
    FOREIGN KEY (financial_year_id, tenant_id) REFERENCES financial_years(id, tenant_id);
