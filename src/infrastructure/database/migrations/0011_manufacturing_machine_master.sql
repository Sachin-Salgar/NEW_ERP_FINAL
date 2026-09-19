CREATE TABLE public.manufacturing_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL,
  code varchar(50) NOT NULL,
  name varchar(255) NOT NULL,
  serial_number varchar(150),
  model varchar(150),
  manufacturer varchar(150),
  manufacture_year integer,
  section varchar(150),
  division varchar(150),
  operational_group varchar(150),
  capacity numeric(18,4),
  capacity_uom varchar(30),
  power numeric(18,4),
  power_uom varchar(30),
  cut_time_applicable boolean NOT NULL DEFAULT true,
  production_machine boolean NOT NULL DEFAULT false,
  fixed_asset_id uuid,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT manufacturing_machine_status_check CHECK (status IN ('ACTIVE','INACTIVE','MAINTENANCE')),
  CONSTRAINT manufacturing_machine_year_check CHECK (manufacture_year IS NULL OR (manufacture_year >= 1900 AND manufacture_year <= EXTRACT(YEAR FROM CURRENT_DATE)::int + 1)),
  CONSTRAINT manufacturing_machine_capacity_check CHECK (capacity IS NULL OR capacity >= 0),
  CONSTRAINT manufacturing_machine_power_check CHECK (power IS NULL OR power >= 0),
  CONSTRAINT manufacturing_machine_soft_delete_check CHECK ((is_deleted = false AND deleted_at IS NULL) OR (is_deleted = true AND deleted_at IS NOT NULL))
);
ALTER TABLE public.manufacturing_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_machines FORCE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX uq_manufacturing_machine_id_tenant ON public.manufacturing_machines(id, tenant_id);
CREATE UNIQUE INDEX uq_manufacturing_machine_code_active ON public.manufacturing_machines(tenant_id, branch_id, code) WHERE is_deleted = false;
CREATE INDEX idx_manufacturing_machine_list ON public.manufacturing_machines(tenant_id, branch_id, status, code, id) WHERE is_deleted = false;
CREATE POLICY manufacturing_machine_tenant_policy ON public.manufacturing_machines
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
REVOKE ALL ON public.manufacturing_machines FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.manufacturing_machines TO erp_app;
