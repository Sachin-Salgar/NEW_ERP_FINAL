DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'sales_quotations'
       AND column_name = 'version'
  ) AND NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'sales_quotations'
       AND column_name = 'version_number'
  ) THEN
    ALTER TABLE sales_quotations RENAME COLUMN version TO version_number;
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE sales_quotation_items
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1;
--> statement-breakpoint

UPDATE sales_quotation_items AS item
   SET created_by = quotation.created_by
  FROM sales_quotations AS quotation
 WHERE item.quotation_id = quotation.id
   AND item.tenant_id = quotation.tenant_id
   AND item.created_by IS NULL;
