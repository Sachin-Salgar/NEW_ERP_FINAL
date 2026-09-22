BEGIN;

CREATE TABLE IF NOT EXISTS public.hr_legal_entities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 code varchar(50) NOT NULL, name varchar(200) NOT NULL, registration_no varchar(100), tax_id varchar(100),
 status varchar(20) NOT NULL DEFAULT 'ACTIVE', metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_grades (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 code varchar(50) NOT NULL, name varchar(120) NOT NULL, min_salary numeric(14,2), max_salary numeric(14,2),
 status varchar(20) NOT NULL DEFAULT 'ACTIVE', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_headcount_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 department_id uuid, position_id uuid, branch_id uuid, fiscal_year varchar(20) NOT NULL,
 planned_headcount numeric(10,2) NOT NULL DEFAULT 0, approved_headcount numeric(10,2) NOT NULL DEFAULT 0,
 filled_headcount numeric(10,2) NOT NULL DEFAULT 0, status varchar(30) NOT NULL DEFAULT 'DRAFT', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_wfh_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id), start_date date NOT NULL, end_date date NOT NULL,
 days numeric(10,2) NOT NULL, reason text, status varchar(30) NOT NULL DEFAULT 'PENDING',
 workflow_instance_id uuid, approved_by uuid, approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_business_travel_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id), start_date date NOT NULL, end_date date NOT NULL,
 destination varchar(200) NOT NULL, purpose text, estimated_cost numeric(14,2) NOT NULL DEFAULT 0,
 status varchar(30) NOT NULL DEFAULT 'PENDING', workflow_instance_id uuid, approved_by uuid, approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_missing_punch_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id), attendance_id uuid, attendance_date date NOT NULL,
 missing_direction varchar(10) NOT NULL, status varchar(30) NOT NULL DEFAULT 'OPEN',
 resolution_type varchar(30), resolved_at timestamptz, resolved_by uuid, reason text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_attendance_import_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 source varchar(40) NOT NULL, external_reference varchar(150), imported_at timestamptz NOT NULL DEFAULT now(),
 row_count integer NOT NULL DEFAULT 0, success_count integer NOT NULL DEFAULT 0, error_count integer NOT NULL DEFAULT 0,
 status varchar(30) NOT NULL DEFAULT 'IMPORTED', metadata jsonb NOT NULL DEFAULT '{}', created_by uuid
);
CREATE TABLE IF NOT EXISTS public.hr_attendance_import_rows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 batch_id uuid NOT NULL REFERENCES public.hr_attendance_import_batches(id) ON DELETE CASCADE, employee_id uuid,
 punch_at timestamptz, direction varchar(10), external_reference varchar(150), status varchar(30) NOT NULL DEFAULT 'PENDING',
 error_message text
);
CREATE TABLE IF NOT EXISTS public.hr_statutory_calculations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 payroll_run_id uuid NOT NULL REFERENCES public.hr_payroll_runs(id) ON DELETE CASCADE, employee_id uuid NOT NULL REFERENCES public.hr_employees(id),
 rule_id uuid NOT NULL REFERENCES public.hr_statutory_rules(id), base_amount numeric(14,2) NOT NULL DEFAULT 0,
 employee_amount numeric(14,2) NOT NULL DEFAULT 0, employer_amount numeric(14,2) NOT NULL DEFAULT 0,
 calculation jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_payroll_reversals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 payroll_run_id uuid NOT NULL REFERENCES public.hr_payroll_runs(id), reversal_reference varchar(120) NOT NULL,
 reason text NOT NULL, status varchar(30) NOT NULL DEFAULT 'REQUESTED', reversed_by uuid, reversed_at timestamptz,
 replacement_run_id uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_payroll_validation_results (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 payroll_run_id uuid NOT NULL REFERENCES public.hr_payroll_runs(id) ON DELETE CASCADE,
 severity varchar(20) NOT NULL, code varchar(80) NOT NULL, message text NOT NULL, employee_id uuid,
 resolved boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_attendance_state_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 attendance_id uuid NOT NULL REFERENCES public.hr_attendance(id) ON DELETE CASCADE, from_status varchar(30),
 to_status varchar(30) NOT NULL, reason varchar(100), changed_at timestamptz NOT NULL DEFAULT now(), changed_by uuid
);
CREATE TABLE IF NOT EXISTS public.hr_leave_policy_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 year integer NOT NULL, run_date date NOT NULL, carry_forward_applied boolean NOT NULL DEFAULT false,
 expiry_applied boolean NOT NULL DEFAULT false, status varchar(30) NOT NULL DEFAULT 'COMPLETED', created_by uuid,
 UNIQUE(tenant_id,year,run_date)
);

ALTER TABLE public.hr_finance_postings ADD COLUMN IF NOT EXISTS posted_at timestamptz;
ALTER TABLE public.hr_finance_postings ADD COLUMN IF NOT EXISTS journal_reference varchar(100);
ALTER TABLE public.hr_payroll_runs ADD COLUMN IF NOT EXISTS validation_status varchar(20) NOT NULL DEFAULT 'NOT_RUN';
ALTER TABLE public.hr_payroll_runs ADD COLUMN IF NOT EXISTS reversed_at timestamptz;

DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT unnest(ARRAY[
 'hr_legal_entities','hr_grades','hr_headcount_plans','hr_wfh_requests','hr_business_travel_requests','hr_missing_punch_cases',
 'hr_attendance_import_batches','hr_attendance_import_rows','hr_statutory_calculations','hr_payroll_reversals',
 'hr_payroll_validation_results','hr_attendance_state_history','hr_leave_policy_runs'
 ]) LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',t||'_tenant_policy',t);
  EXECUTE format('CREATE POLICY %I ON public.%I USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)',t||'_tenant_policy',t);
 END LOOP;
END $$;

DO $$ DECLARE p text; a text; BEGIN
 FOR p IN SELECT unnest(ARRAY['legal_entity','grade','headcount_plan','wfh_request','business_travel_request','missing_punch_case','attendance_import_batch','attendance_import_row','statutory_calculation','payroll_reversal','payroll_validation_result','attendance_state_history','leave_policy_run']) LOOP
  FOREACH a IN ARRAY ARRAY['create','read','update','delete'] LOOP
   INSERT INTO public.permissions(id,module_code,resource,action,scope,permission_key,display_name,description,is_system)
   VALUES(gen_random_uuid(),'hr',p,a,'tenant','hr.'||p||'.'||a,'HR '||p||' '||a,'HR capability',false)
   ON CONFLICT(permission_key) DO UPDATE SET module_code='hr';
  END LOOP;
 END LOOP;
END $$;

COMMIT;