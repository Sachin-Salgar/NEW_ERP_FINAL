-- Forward-only correction for the Purchase slice. Existing business rows are preserved.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['procurement_suppliers','procurement_requisitions','procurement_requisition_lines','procurement_purchase_orders','procurement_purchase_order_lines','procurement_receipts','procurement_receipt_lines'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at timestamptz', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_by uuid', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at timestamptz', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_by uuid', t);
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((is_deleted=false AND deleted_at IS NULL) OR (is_deleted=true AND deleted_at IS NOT NULL))', t, t||'_soft_delete_check');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(tenant_id,organization_id,id) WHERE is_deleted=false', 'idx_'||t||'_tenant_org_active', t);
  END LOOP;
END $$;
ALTER TABLE procurement_receipts ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'DRAFT';
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_procurement_supplier_context ON procurement_suppliers(id,organization_id,tenant_id);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_procurement_requisition_context ON procurement_requisitions(id,organization_id,tenant_id,branch_id,financial_year_id);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_procurement_po_context ON procurement_purchase_orders(id,organization_id,tenant_id,branch_id,financial_year_id);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_procurement_receipt_context ON procurement_receipts(id,organization_id,tenant_id,branch_id,financial_year_id);
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_procurement_requisition_org_tenant') THEN
    ALTER TABLE procurement_requisitions ADD CONSTRAINT fk_procurement_requisition_org_tenant FOREIGN KEY(organization_id,tenant_id) REFERENCES organizations(id,tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_procurement_po_org_tenant') THEN
    ALTER TABLE procurement_purchase_orders ADD CONSTRAINT fk_procurement_po_org_tenant FOREIGN KEY(organization_id,tenant_id) REFERENCES organizations(id,tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_procurement_receipt_org_tenant') THEN
    ALTER TABLE procurement_receipts ADD CONSTRAINT fk_procurement_receipt_org_tenant FOREIGN KEY(organization_id,tenant_id) REFERENCES organizations(id,tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_procurement_requisition_branch_tenant') THEN
    ALTER TABLE procurement_requisitions ADD CONSTRAINT fk_procurement_requisition_branch_tenant FOREIGN KEY(branch_id,tenant_id) REFERENCES branches(id,tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_procurement_requisition_fy_tenant') THEN
    ALTER TABLE procurement_requisitions ADD CONSTRAINT fk_procurement_requisition_fy_tenant FOREIGN KEY(financial_year_id,tenant_id) REFERENCES financial_years(id,tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_procurement_po_branch_tenant') THEN
    ALTER TABLE procurement_purchase_orders ADD CONSTRAINT fk_procurement_po_branch_tenant FOREIGN KEY(branch_id,tenant_id) REFERENCES branches(id,tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_procurement_po_fy_tenant') THEN
    ALTER TABLE procurement_purchase_orders ADD CONSTRAINT fk_procurement_po_fy_tenant FOREIGN KEY(financial_year_id,tenant_id) REFERENCES financial_years(id,tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_procurement_receipt_branch_tenant') THEN
    ALTER TABLE procurement_receipts ADD CONSTRAINT fk_procurement_receipt_branch_tenant FOREIGN KEY(branch_id,tenant_id) REFERENCES branches(id,tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_procurement_receipt_fy_tenant') THEN
    ALTER TABLE procurement_receipts ADD CONSTRAINT fk_procurement_receipt_fy_tenant FOREIGN KEY(financial_year_id,tenant_id) REFERENCES financial_years(id,tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_procurement_po_supplier_context') THEN
    ALTER TABLE procurement_purchase_orders ADD CONSTRAINT fk_procurement_po_supplier_context FOREIGN KEY(supplier_id,organization_id,tenant_id) REFERENCES procurement_suppliers(id,organization_id,tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_procurement_requisition_line_org_tenant') THEN
    ALTER TABLE procurement_requisition_lines ADD CONSTRAINT fk_procurement_requisition_line_org_tenant FOREIGN KEY(organization_id,tenant_id) REFERENCES organizations(id,tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_procurement_po_line_org_tenant') THEN
    ALTER TABLE procurement_purchase_order_lines ADD CONSTRAINT fk_procurement_po_line_org_tenant FOREIGN KEY(organization_id,tenant_id) REFERENCES organizations(id,tenant_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_procurement_receipt_line_org_tenant') THEN
    ALTER TABLE procurement_receipt_lines ADD CONSTRAINT fk_procurement_receipt_line_org_tenant FOREIGN KEY(organization_id,tenant_id) REFERENCES organizations(id,tenant_id);
  END IF;
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['procurement_suppliers','procurement_requisitions','procurement_requisition_lines','procurement_purchase_orders','procurement_purchase_order_lines','procurement_receipts','procurement_receipt_lines'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_tenant_policy',t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (tenant_id=current_setting(''app.current_tenant_id'',true)::uuid AND (current_setting(''app.current_tenant_id_organization_id'',true) IS NULL OR organization_id=current_setting(''app.current_tenant_id_organization_id'',true)::uuid)) WITH CHECK (tenant_id=current_setting(''app.current_tenant_id'',true)::uuid AND (current_setting(''app.current_tenant_id_organization_id'',true) IS NULL OR organization_id=current_setting(''app.current_tenant_id_organization_id'',true)::uuid))', t||'_tenant_policy',t);
  END LOOP;
END $$;
