-- Platform -> Tenant -> Branch contract.
--
-- This is the contract step for the architecture reconciliation.  The earlier
-- migrations create the historical organization/location representation so the
-- chain can be applied to existing installations; this migration removes that
-- representation from the resulting schema.  Inventory warehouses are retained
-- as tenant-owned domain records.

DO $$
BEGIN
  IF to_regclass('public.organizations') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_initialize_core_organization_modules ON public.organizations;
  END IF;
END
$$;
DROP FUNCTION IF EXISTS public.initialize_core_organization_modules();

DROP TABLE IF EXISTS public.user_location_access CASCADE;
DROP TABLE IF EXISTS public.user_organization_access CASCADE;
DROP TABLE IF EXISTS public.organization_modules CASCADE;
DROP TABLE IF EXISTS public.locations CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;

DO $$
DECLARE
  constraint_record record;
  index_record record;
  policy_record record;
  column_record record;
  has_policy boolean;
BEGIN
  -- Remove constraints and indexes that encode the retired hierarchy before
  -- removing its columns.  This is intentionally catalog-driven so the
  -- migration remains repeatable across databases at different checkpoints.
  FOR constraint_record IN
    SELECT DISTINCT
      n.nspname AS schema_name,
      c.relname AS table_name,
      con.conname AS constraint_name
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND con.contype IN ('f', 'p', 'u', 'x')
      AND EXISTS (
        SELECT 1
        FROM unnest(con.conkey) AS key_column(attnum)
        JOIN pg_attribute a
          ON a.attrelid = c.oid
         AND a.attnum = key_column.attnum
        WHERE a.attname IN ('organization_id', 'location_id')
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
      constraint_record.schema_name,
      constraint_record.table_name,
      constraint_record.constraint_name
    );
  END LOOP;

  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        COALESCE(qual, '') ILIKE '%organization_id%'
        OR COALESCE(qual, '') ILIKE '%location_id%'
        OR COALESCE(with_check, '') ILIKE '%organization_id%'
        OR COALESCE(with_check, '') ILIKE '%location_id%'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;

  FOR index_record IN
    SELECT schemaname, tablename, indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND (
        indexdef ILIKE '%organization_id%'
        OR indexdef ILIKE '%location_id%'
      )
  LOOP
    EXECUTE format(
      'DROP INDEX IF EXISTS %I.%I CASCADE',
      index_record.schemaname,
      index_record.indexname
    );
  END LOOP;

  FOR column_record IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('organization_id', 'location_id')
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I DROP COLUMN IF EXISTS %I',
      column_record.table_name,
      column_record.column_name
    );
  END LOOP;

  -- Tables whose only policy was retired above must remain tenant-isolated.
  FOR column_record IN
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN pg_class pc
      ON pc.relname = c.table_name
    JOIN pg_namespace pn
      ON pn.oid = pc.relnamespace
     AND pn.nspname = 'public'
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenant_id'
      AND pc.relrowsecurity
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = column_record.table_name
    ) INTO has_policy;

    IF NOT has_policy THEN
      EXECUTE format(
        'CREATE POLICY tenant_context_isolation_policy ON public.%I
           USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)
           WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)',
        column_record.table_name
      );
    END IF;
  END LOOP;
END
$$;

-- Re-establish tenant-only keys and lookup indexes for the tables that were
-- previously organization-scoped.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_financial_year
  ON public.financial_years (tenant_id)
  WHERE is_active = true AND is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_item_code
  ON public.inventory_items (tenant_id, code)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_inventory_item_name
  ON public.inventory_items (tenant_id, name, id)
  WHERE is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_warehouse_code
  ON public.inventory_warehouses (tenant_id, code);

CREATE INDEX IF NOT EXISTS idx_customer_tenant_name
  ON public.customers (tenant_id, name, id)
  WHERE is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_quotation_id_tenant
  ON public.sales_quotations (id, tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_quotation_context
  ON public.sales_quotations (id, tenant_id, branch_id, financial_year_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_quotation_number
  ON public.sales_quotations (tenant_id, quotation_number);

CREATE INDEX IF NOT EXISTS idx_sales_quotation_list
  ON public.sales_quotations (tenant_id, quotation_number, id)
  WHERE is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_order_number
  ON public.sales_orders (tenant_id, order_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_order_context
  ON public.sales_orders (id, tenant_id, branch_id, financial_year_id);

ALTER TABLE public.sales_orders
  DROP CONSTRAINT IF EXISTS fk_sales_order_quotation_context;

ALTER TABLE public.sales_orders
  ADD CONSTRAINT fk_sales_order_quotation_context
  FOREIGN KEY (quotation_id, tenant_id, branch_id, financial_year_id)
  REFERENCES public.sales_quotations (id, tenant_id, branch_id, financial_year_id);

ALTER TABLE public.sales_order_items
  DROP CONSTRAINT IF EXISTS fk_sales_order_item_order_context;

ALTER TABLE public.sales_order_items
  ADD CONSTRAINT fk_sales_order_item_order_context
  FOREIGN KEY (order_id, tenant_id, branch_id, financial_year_id)
  REFERENCES public.sales_orders (id, tenant_id, branch_id, financial_year_id)
  ON DELETE CASCADE;
