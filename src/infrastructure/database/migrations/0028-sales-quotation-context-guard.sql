CREATE OR REPLACE FUNCTION prevent_implicit_sales_quotation_context_backfill()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (OLD.branch_id IS NULL AND NEW.branch_id IS NOT NULL)
     OR (OLD.financial_year_id IS NULL AND NEW.financial_year_id IS NOT NULL) THEN
    IF current_setting('app.allow_quotation_context_reclassification', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Sales quotation context reclassification requires explicit authorization';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS sales_quotation_context_backfill_guard ON sales_quotations;
CREATE TRIGGER sales_quotation_context_backfill_guard
BEFORE UPDATE OF branch_id, financial_year_id ON sales_quotations
FOR EACH ROW
EXECUTE FUNCTION prevent_implicit_sales_quotation_context_backfill();
