CREATE TABLE IF NOT EXISTS tax_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  code varchar(64) NOT NULL,
  name varchar(200) NOT NULL,
  rate numeric(9,4) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'INACTIVE',
  effective_from date NOT NULL,
  effective_to date,
  version_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  CONSTRAINT fk_tax_rule_org FOREIGN KEY (organization_id,tenant_id) REFERENCES organizations(id,tenant_id),
  CONSTRAINT uq_tax_rule_code UNIQUE (tenant_id,organization_id,code),
  CONSTRAINT check_tax_rule_rate CHECK (rate >= 0 AND rate <= 100),
  CONSTRAINT check_tax_rule_status CHECK (status IN ('ACTIVE','INACTIVE')),
  CONSTRAINT check_tax_rule_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX IF NOT EXISTS idx_tax_rule_resolution ON tax_rules(tenant_id,organization_id,status,effective_from,effective_to);
ALTER TABLE tax_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tax_rules_tenant_policy ON tax_rules;
CREATE POLICY tax_rules_tenant_policy ON tax_rules FOR ALL USING (tenant_id=current_setting('app.current_tenant_id',true)::uuid) WITH CHECK (tenant_id=current_setting('app.current_tenant_id',true)::uuid);
