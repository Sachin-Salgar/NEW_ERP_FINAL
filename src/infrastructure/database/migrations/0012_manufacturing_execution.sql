CREATE TABLE public.manufacturing_tools (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 branch_id uuid NOT NULL, code varchar(80) NOT NULL, name varchar(255) NOT NULL, status varchar(20) NOT NULL DEFAULT 'AVAILABLE',
 is_deleted boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_at timestamptz, updated_by uuid,
 CONSTRAINT manufacturing_tool_status_check CHECK (status IN ('AVAILABLE','IN_USE','MAINTENANCE','INACTIVE')),
 CONSTRAINT manufacturing_tool_soft_delete_check CHECK ((is_deleted=false AND deleted_at IS NULL) OR (is_deleted=true AND deleted_at IS NOT NULL))
);
ALTER TABLE public.manufacturing_tools ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by uuid;
ALTER TABLE public.manufacturing_tools ADD CONSTRAINT fk_manufacturing_tool_branch_tenant FOREIGN KEY (branch_id,tenant_id) REFERENCES public.branches(id,tenant_id);
CREATE UNIQUE INDEX uq_manufacturing_tool_code ON public.manufacturing_tools(tenant_id,branch_id,code) WHERE is_deleted=false;

CREATE TABLE public.manufacturing_fixtures (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 branch_id uuid NOT NULL, code varchar(80) NOT NULL, name varchar(255) NOT NULL, status varchar(20) NOT NULL DEFAULT 'AVAILABLE',
 is_deleted boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_at timestamptz, updated_by uuid,
 deleted_at timestamptz, deleted_by uuid,
 CONSTRAINT manufacturing_fixture_status_check CHECK (status IN ('AVAILABLE','IN_USE','MAINTENANCE','INACTIVE')),
 CONSTRAINT manufacturing_fixture_soft_delete_check CHECK ((is_deleted=false AND deleted_at IS NULL) OR (is_deleted=true AND deleted_at IS NOT NULL))
);
ALTER TABLE public.manufacturing_fixtures ADD CONSTRAINT fk_manufacturing_fixture_branch_tenant FOREIGN KEY (branch_id,tenant_id) REFERENCES public.branches(id,tenant_id);
CREATE UNIQUE INDEX uq_manufacturing_fixture_code ON public.manufacturing_fixtures(tenant_id,branch_id,code) WHERE is_deleted=false;

CREATE TABLE public.manufacturing_calibrations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 branch_id uuid NOT NULL, entity_type varchar(30) NOT NULL, entity_id uuid NOT NULL, valid_from date NOT NULL, valid_until date NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'VALID', certificate_no varchar(100), created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
 CONSTRAINT manufacturing_calibration_dates CHECK (valid_until>=valid_from),
 CONSTRAINT manufacturing_calibration_status CHECK (status IN ('VALID','EXPIRED','REVOKED'))
);
ALTER TABLE public.manufacturing_calibrations ADD CONSTRAINT fk_manufacturing_calibration_branch_tenant FOREIGN KEY (branch_id,tenant_id) REFERENCES public.branches(id,tenant_id);
CREATE INDEX idx_manufacturing_calibration_entity ON public.manufacturing_calibrations(tenant_id,entity_type,entity_id,valid_until);

CREATE TABLE public.manufacturing_machine_capabilities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 branch_id uuid NOT NULL, machine_id uuid NOT NULL, operation_code varchar(80) NOT NULL, capability_name varchar(255),
 min_value numeric(18,4), max_value numeric(18,4), parameter_uom varchar(30), tooling_id uuid, fixture_id uuid,
 status varchar(20) NOT NULL DEFAULT 'ACTIVE', version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
 updated_at timestamptz, updated_by uuid, is_deleted boolean NOT NULL DEFAULT false, deleted_at timestamptz, deleted_by uuid,
 CONSTRAINT manufacturing_capability_range CHECK ((min_value IS NULL OR min_value>=0) AND (max_value IS NULL OR max_value>=0) AND (min_value IS NULL OR max_value IS NULL OR min_value<=max_value)),
 CONSTRAINT manufacturing_capability_status CHECK (status IN ('ACTIVE','INACTIVE')),
 CONSTRAINT manufacturing_capability_soft_delete CHECK ((is_deleted=false AND deleted_at IS NULL) OR (is_deleted=true AND deleted_at IS NOT NULL))
);
ALTER TABLE public.manufacturing_machine_capabilities ADD CONSTRAINT fk_capability_branch_tenant FOREIGN KEY (branch_id,tenant_id) REFERENCES public.branches(id,tenant_id);
ALTER TABLE public.manufacturing_machine_capabilities ADD CONSTRAINT fk_capability_machine_tenant FOREIGN KEY (machine_id,tenant_id) REFERENCES public.manufacturing_machines(id,tenant_id);
ALTER TABLE public.manufacturing_machine_capabilities ADD CONSTRAINT fk_capability_tool_tenant FOREIGN KEY (tooling_id,tenant_id) REFERENCES public.manufacturing_tools(id,tenant_id);
ALTER TABLE public.manufacturing_machine_capabilities ADD CONSTRAINT fk_capability_fixture_tenant FOREIGN KEY (fixture_id,tenant_id) REFERENCES public.manufacturing_fixtures(id,tenant_id);
CREATE UNIQUE INDEX uq_manufacturing_capability ON public.manufacturing_machine_capabilities(tenant_id,machine_id,operation_code) WHERE is_deleted=false;

CREATE TABLE public.manufacturing_process_details (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 branch_id uuid NOT NULL, item_id uuid NOT NULL, revision varchar(40) NOT NULL, drawing_number varchar(100), drawing_revision varchar(40),
 input_weight numeric(18,4), finished_weight numeric(18,4), gross_weight numeric(18,4), burnt_percent numeric(9,4),
 work_instruction text, pfd text, status varchar(20) NOT NULL DEFAULT 'DRAFT', version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_at timestamptz, updated_by uuid, is_deleted boolean NOT NULL DEFAULT false,
 deleted_at timestamptz, deleted_by uuid,
 CONSTRAINT manufacturing_process_weight CHECK ((input_weight IS NULL OR input_weight>=0) AND (finished_weight IS NULL OR finished_weight>=0) AND (gross_weight IS NULL OR gross_weight>=0) AND (burnt_percent IS NULL OR burnt_percent>=0)),
 CONSTRAINT manufacturing_process_status CHECK (status IN ('DRAFT','ACTIVE','OBSOLETE')),
 CONSTRAINT manufacturing_process_soft_delete CHECK ((is_deleted=false AND deleted_at IS NULL) OR (is_deleted=true AND deleted_at IS NOT NULL))
);
ALTER TABLE public.manufacturing_process_details ADD CONSTRAINT fk_process_branch_tenant FOREIGN KEY (branch_id,tenant_id) REFERENCES public.branches(id,tenant_id);
ALTER TABLE public.manufacturing_process_details ADD CONSTRAINT fk_process_item_tenant FOREIGN KEY (item_id,tenant_id) REFERENCES public.inventory_items(id,tenant_id);
CREATE UNIQUE INDEX uq_manufacturing_process_revision ON public.manufacturing_process_details(tenant_id,item_id,revision) WHERE is_deleted=false;

CREATE TABLE public.manufacturing_routing_operations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 branch_id uuid NOT NULL, process_detail_id uuid NOT NULL, sequence_no integer NOT NULL, operation_code varchar(80) NOT NULL,
 operation_description varchar(500) NOT NULL, machine_group varchar(100), machine_code varchar(80), manpower numeric(10,2),
 cycle_time_seconds numeric(18,4), setup_time_seconds numeric(18,4), allowance_percent numeric(9,4), overhead_seconds numeric(18,4),
 batch_quantity numeric(18,4), tooling_description varchar(500), work_instruction text, process_parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_at timestamptz, updated_by uuid,
 CONSTRAINT manufacturing_routing_sequence CHECK (sequence_no>0),
 CONSTRAINT manufacturing_routing_times CHECK ((cycle_time_seconds IS NULL OR cycle_time_seconds>=0) AND (setup_time_seconds IS NULL OR setup_time_seconds>=0) AND (allowance_percent IS NULL OR allowance_percent>=0) AND (overhead_seconds IS NULL OR overhead_seconds>=0) AND (batch_quantity IS NULL OR batch_quantity>0))
);
ALTER TABLE public.manufacturing_routing_operations ADD CONSTRAINT fk_routing_process_tenant FOREIGN KEY (process_detail_id,tenant_id) REFERENCES public.manufacturing_process_details(id,tenant_id);
CREATE UNIQUE INDEX uq_manufacturing_routing_sequence ON public.manufacturing_routing_operations(tenant_id,process_detail_id,sequence_no);

CREATE TABLE public.manufacturing_work_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 branch_id uuid NOT NULL, work_order_number varchar(80) NOT NULL, customer_id uuid, item_id uuid NOT NULL, process_detail_id uuid NOT NULL,
 planned_quantity numeric(18,4) NOT NULL, scheduled_start timestamptz, scheduled_end timestamptz, priority integer NOT NULL DEFAULT 0,
 status varchar(20) NOT NULL DEFAULT 'PLANNED', notes text, version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
 updated_at timestamptz, updated_by uuid, is_deleted boolean NOT NULL DEFAULT false, deleted_at timestamptz, deleted_by uuid,
 CONSTRAINT manufacturing_wo_qty CHECK (planned_quantity>0), CONSTRAINT manufacturing_wo_dates CHECK (scheduled_end IS NULL OR scheduled_start IS NULL OR scheduled_end>=scheduled_start),
 CONSTRAINT manufacturing_wo_status CHECK (status IN ('PLANNED','SCHEDULED','RELEASED','IN_PROGRESS','COMPLETED','CANCELLED')),
 CONSTRAINT manufacturing_wo_soft_delete CHECK ((is_deleted=false AND deleted_at IS NULL) OR (is_deleted=true AND deleted_at IS NOT NULL))
);
ALTER TABLE public.manufacturing_work_orders ADD CONSTRAINT fk_wo_branch_tenant FOREIGN KEY (branch_id,tenant_id) REFERENCES public.branches(id,tenant_id);
ALTER TABLE public.manufacturing_work_orders ADD CONSTRAINT fk_wo_item_tenant FOREIGN KEY (item_id,tenant_id) REFERENCES public.inventory_items(id,tenant_id);
ALTER TABLE public.manufacturing_work_orders ADD CONSTRAINT fk_wo_process_tenant FOREIGN KEY (process_detail_id,tenant_id) REFERENCES public.manufacturing_process_details(id,tenant_id);
ALTER TABLE public.manufacturing_work_orders ADD CONSTRAINT fk_wo_customer_tenant FOREIGN KEY (customer_id,tenant_id) REFERENCES public.customers(id,tenant_id);
CREATE UNIQUE INDEX uq_manufacturing_wo_number ON public.manufacturing_work_orders(tenant_id,work_order_number) WHERE is_deleted=false;

CREATE TABLE public.manufacturing_task_sheets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 branch_id uuid NOT NULL, work_order_id uuid NOT NULL, routing_operation_id uuid NOT NULL, sequence_no integer NOT NULL,
 machine_id uuid, planned_quantity numeric(18,4) NOT NULL, good_quantity numeric(18,4) NOT NULL DEFAULT 0, rework_quantity numeric(18,4) NOT NULL DEFAULT 0,
 reject_quantity numeric(18,4) NOT NULL DEFAULT 0, return_quantity numeric(18,4) NOT NULL DEFAULT 0, status varchar(20) NOT NULL DEFAULT 'PENDING',
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_at timestamptz, updated_by uuid,
 CONSTRAINT manufacturing_task_qty CHECK (planned_quantity>0 AND good_quantity>=0 AND rework_quantity>=0 AND reject_quantity>=0 AND return_quantity>=0),
 CONSTRAINT manufacturing_task_status CHECK (status IN ('PENDING','READY','RUNNING','PAUSED','COMPLETED','CANCELLED'))
);
ALTER TABLE public.manufacturing_task_sheets ADD CONSTRAINT fk_task_branch_tenant FOREIGN KEY (branch_id,tenant_id) REFERENCES public.branches(id,tenant_id);
ALTER TABLE public.manufacturing_task_sheets ADD CONSTRAINT fk_task_wo_tenant FOREIGN KEY (work_order_id,tenant_id) REFERENCES public.manufacturing_work_orders(id,tenant_id);
ALTER TABLE public.manufacturing_task_sheets ADD CONSTRAINT fk_task_routing_tenant FOREIGN KEY (routing_operation_id,tenant_id) REFERENCES public.manufacturing_routing_operations(id,tenant_id);
ALTER TABLE public.manufacturing_task_sheets ADD CONSTRAINT fk_task_machine_tenant FOREIGN KEY (machine_id,tenant_id) REFERENCES public.manufacturing_machines(id,tenant_id);
CREATE UNIQUE INDEX uq_manufacturing_task_operation ON public.manufacturing_task_sheets(tenant_id,work_order_id,routing_operation_id);

CREATE TABLE public.manufacturing_material_requisitions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 branch_id uuid NOT NULL, requisition_number varchar(80) NOT NULL, work_order_id uuid NOT NULL, status varchar(20) NOT NULL DEFAULT 'REQUESTED',
 notes text, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_at timestamptz, updated_by uuid,
 CONSTRAINT manufacturing_mr_status CHECK (status IN ('REQUESTED','PARTIAL','ISSUED','CANCELLED'))
);
ALTER TABLE public.manufacturing_material_requisitions ADD CONSTRAINT fk_mr_branch_tenant FOREIGN KEY (branch_id,tenant_id) REFERENCES public.branches(id,tenant_id);
ALTER TABLE public.manufacturing_material_requisitions ADD CONSTRAINT fk_mr_wo_tenant FOREIGN KEY (work_order_id,tenant_id) REFERENCES public.manufacturing_work_orders(id,tenant_id);
CREATE UNIQUE INDEX uq_manufacturing_mr_number ON public.manufacturing_material_requisitions(tenant_id,requisition_number);

CREATE TABLE public.manufacturing_material_requisition_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 branch_id uuid NOT NULL, requisition_id uuid NOT NULL, item_id uuid NOT NULL, required_quantity numeric(18,4) NOT NULL, issued_quantity numeric(18,4) NOT NULL DEFAULT 0,
 heat_lot_id varchar(120), min_quantity numeric(18,4), max_quantity numeric(18,4),
 CONSTRAINT manufacturing_mr_line_qty CHECK (required_quantity>0 AND issued_quantity>=0 AND issued_quantity<=required_quantity)
);
ALTER TABLE public.manufacturing_material_requisition_lines ADD CONSTRAINT fk_mr_line_branch_tenant FOREIGN KEY (branch_id,tenant_id) REFERENCES public.branches(id,tenant_id);
ALTER TABLE public.manufacturing_material_requisition_lines ADD CONSTRAINT fk_mr_line_req_tenant FOREIGN KEY (requisition_id,tenant_id) REFERENCES public.manufacturing_material_requisitions(id,tenant_id);
ALTER TABLE public.manufacturing_material_requisition_lines ADD CONSTRAINT fk_mr_line_item_tenant FOREIGN KEY (item_id,tenant_id) REFERENCES public.inventory_items(id,tenant_id);

CREATE TABLE public.manufacturing_material_issues (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 branch_id uuid NOT NULL, requisition_line_id uuid NOT NULL, warehouse_id uuid NOT NULL, item_id uuid NOT NULL, quantity numeric(18,4) NOT NULL,
 heat_lot_id varchar(120), operation_key varchar(128) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
 CONSTRAINT manufacturing_material_issue_qty CHECK (quantity>0)
);
ALTER TABLE public.manufacturing_material_issues ADD CONSTRAINT fk_mi_branch_tenant FOREIGN KEY (branch_id,tenant_id) REFERENCES public.branches(id,tenant_id);
ALTER TABLE public.manufacturing_material_issues ADD CONSTRAINT fk_mi_line_tenant FOREIGN KEY (requisition_line_id,tenant_id) REFERENCES public.manufacturing_material_requisition_lines(id,tenant_id);
ALTER TABLE public.manufacturing_material_issues ADD CONSTRAINT fk_mi_item_tenant FOREIGN KEY (item_id,tenant_id) REFERENCES public.inventory_items(id,tenant_id);
CREATE UNIQUE INDEX uq_manufacturing_material_issue_key ON public.manufacturing_material_issues(tenant_id,operation_key);

CREATE TABLE public.manufacturing_readiness_checks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 branch_id uuid NOT NULL, task_sheet_id uuid NOT NULL, machine_id uuid, tool_id uuid, fixture_id uuid, checked_at timestamptz NOT NULL DEFAULT now(),
 machine_ready boolean NOT NULL, tool_ready boolean NOT NULL, fixture_ready boolean NOT NULL, calibration_valid boolean NOT NULL, passed boolean NOT NULL,
 failure_reasons text[] NOT NULL DEFAULT '{}', checked_by uuid
);
ALTER TABLE public.manufacturing_readiness_checks ADD CONSTRAINT fk_ready_branch_tenant FOREIGN KEY (branch_id,tenant_id) REFERENCES public.branches(id,tenant_id);
ALTER TABLE public.manufacturing_readiness_checks ADD CONSTRAINT fk_ready_task_tenant FOREIGN KEY (task_sheet_id,tenant_id) REFERENCES public.manufacturing_task_sheets(id,tenant_id);

CREATE TABLE public.manufacturing_production_outputs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 branch_id uuid NOT NULL, task_sheet_id uuid NOT NULL, quantity numeric(18,4) NOT NULL, output_type varchar(20) NOT NULL,
 heat_lot_id varchar(120), serial_start varchar(120), serial_end varchar(120), process_parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
 punched_at timestamptz NOT NULL DEFAULT now(), punched_by uuid, operation_key varchar(128) NOT NULL,
 CONSTRAINT manufacturing_output_qty CHECK (quantity>0), CONSTRAINT manufacturing_output_type CHECK (output_type IN ('GOOD','REWORK','REJECT','RETURN'))
);
ALTER TABLE public.manufacturing_production_outputs ADD CONSTRAINT fk_output_branch_tenant FOREIGN KEY (branch_id,tenant_id) REFERENCES public.branches(id,tenant_id);
ALTER TABLE public.manufacturing_production_outputs ADD CONSTRAINT fk_output_task_tenant FOREIGN KEY (task_sheet_id,tenant_id) REFERENCES public.manufacturing_task_sheets(id,tenant_id);
CREATE UNIQUE INDEX uq_manufacturing_output_key ON public.manufacturing_production_outputs(tenant_id,operation_key);

CREATE TABLE public.manufacturing_quality_outputs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 branch_id uuid NOT NULL, task_sheet_id uuid NOT NULL, inspected_quantity numeric(18,4) NOT NULL, accepted_quantity numeric(18,4) NOT NULL DEFAULT 0,
 rejected_quantity numeric(18,4) NOT NULL DEFAULT 0, rework_quantity numeric(18,4) NOT NULL DEFAULT 0, returned_quantity numeric(18,4) NOT NULL DEFAULT 0,
 defect_code varchar(80), root_cause varchar(500), disposition varchar(30) NOT NULL DEFAULT 'PENDING', inspected_at timestamptz NOT NULL DEFAULT now(), inspected_by uuid,
 CONSTRAINT manufacturing_quality_qty CHECK (inspected_quantity>0 AND accepted_quantity>=0 AND rejected_quantity>=0 AND rework_quantity>=0 AND returned_quantity>=0),
 CONSTRAINT manufacturing_quality_disposition CHECK (disposition IN ('PENDING','ACCEPTED','REJECTED','REWORK','RETURNED','MIXED'))
);
ALTER TABLE public.manufacturing_quality_outputs ADD CONSTRAINT fk_quality_branch_tenant FOREIGN KEY (branch_id,tenant_id) REFERENCES public.branches(id,tenant_id);
ALTER TABLE public.manufacturing_quality_outputs ADD CONSTRAINT fk_quality_task_tenant FOREIGN KEY (task_sheet_id,tenant_id) REFERENCES public.manufacturing_task_sheets(id,tenant_id);

CREATE TABLE public.manufacturing_material_returns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 branch_id uuid NOT NULL, work_order_id uuid NOT NULL, warehouse_id uuid NOT NULL, item_id uuid NOT NULL, quantity numeric(18,4) NOT NULL,
 heat_lot_id varchar(120), reason varchar(500), return_number varchar(80) NOT NULL, operation_key varchar(128) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
 CONSTRAINT manufacturing_material_return_qty CHECK (quantity>0)
);
ALTER TABLE public.manufacturing_material_returns ADD CONSTRAINT fk_return_branch_tenant FOREIGN KEY (branch_id,tenant_id) REFERENCES public.branches(id,tenant_id);
ALTER TABLE public.manufacturing_material_returns ADD CONSTRAINT fk_return_wo_tenant FOREIGN KEY (work_order_id,tenant_id) REFERENCES public.manufacturing_work_orders(id,tenant_id);
ALTER TABLE public.manufacturing_material_returns ADD CONSTRAINT fk_return_item_tenant FOREIGN KEY (item_id,tenant_id) REFERENCES public.inventory_items(id,tenant_id);
CREATE UNIQUE INDEX uq_manufacturing_material_return_number ON public.manufacturing_material_returns(tenant_id,return_number);
CREATE UNIQUE INDEX uq_manufacturing_material_return_key ON public.manufacturing_material_returns(tenant_id,operation_key);

CREATE TABLE public.manufacturing_variance_costs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 branch_id uuid NOT NULL, work_order_id uuid NOT NULL, task_sheet_id uuid, variance_type varchar(30) NOT NULL, quantity numeric(18,4) NOT NULL,
 unit_cost numeric(18,4) NOT NULL DEFAULT 0, total_cost numeric(18,4) NOT NULL DEFAULT 0, reason varchar(500), created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
 CONSTRAINT manufacturing_variance_qty CHECK (quantity>0 AND unit_cost>=0 AND total_cost>=0),
 CONSTRAINT manufacturing_variance_type CHECK (variance_type IN ('REWORK','REJECTION','SCRAP','MATERIAL_RETURN'))
);
ALTER TABLE public.manufacturing_variance_costs ADD CONSTRAINT fk_variance_branch_tenant FOREIGN KEY (branch_id,tenant_id) REFERENCES public.branches(id,tenant_id);
ALTER TABLE public.manufacturing_variance_costs ADD CONSTRAINT fk_variance_wo_tenant FOREIGN KEY (work_order_id,tenant_id) REFERENCES public.manufacturing_work_orders(id,tenant_id);
ALTER TABLE public.manufacturing_variance_costs ADD CONSTRAINT fk_variance_task_tenant FOREIGN KEY (task_sheet_id,tenant_id) REFERENCES public.manufacturing_task_sheets(id,tenant_id);

DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['manufacturing_tools','manufacturing_fixtures','manufacturing_calibrations','manufacturing_machine_capabilities','manufacturing_process_details','manufacturing_routing_operations','manufacturing_work_orders','manufacturing_task_sheets','manufacturing_material_requisitions','manufacturing_material_requisition_lines','manufacturing_material_issues','manufacturing_readiness_checks','manufacturing_production_outputs','manufacturing_quality_outputs','manufacturing_material_returns','manufacturing_variance_costs']
 LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY %I ON public.%I USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)',t||'_tenant_policy',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO erp_app',t);
 END LOOP;
END $$;
