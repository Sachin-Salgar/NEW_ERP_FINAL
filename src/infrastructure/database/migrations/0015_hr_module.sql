-- HR module foundation: employee lifecycle, organization, attendance, leave, payroll,
-- recruitment, performance, learning, ESS, compliance and workforce analytics.
BEGIN;

INSERT INTO public.modules (id, code, name, module_group, description, route, is_core, sort_order, created_at)
VALUES (gen_random_uuid(), 'hr', 'Human Resources', 'business', 'Employee lifecycle, attendance, leave, payroll and workforce management.', '/hr', false, 80, NOW())
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, route=EXCLUDED.route;

CREATE TABLE IF NOT EXISTS public.hr_departments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 code varchar(50) NOT NULL, name varchar(150) NOT NULL, parent_id uuid REFERENCES public.hr_departments(id),
 branch_id uuid, manager_employee_id uuid, status varchar(20) NOT NULL DEFAULT 'ACTIVE',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz, is_deleted boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.hr_positions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 code varchar(50) NOT NULL, title varchar(150) NOT NULL, department_id uuid REFERENCES public.hr_departments(id),
 reports_to_position_id uuid REFERENCES public.hr_positions(id), grade varchar(50), employment_type varchar(50),
 budgeted_headcount numeric(10,2) NOT NULL DEFAULT 1, status varchar(20) NOT NULL DEFAULT 'OPEN',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz, is_deleted boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.hr_employees (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_no varchar(50) NOT NULL, identity_id uuid REFERENCES public.identities(id), user_id uuid REFERENCES public.users(id),
 first_name varchar(100) NOT NULL, middle_name varchar(100), last_name varchar(100), preferred_name varchar(100),
 gender varchar(30), date_of_birth date, personal_email varchar(255), work_email varchar(255), phone varchar(50),
 address jsonb NOT NULL DEFAULT '{}'::jsonb, emergency_contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
 branch_id uuid, department_id uuid REFERENCES public.hr_departments(id), position_id uuid REFERENCES public.hr_positions(id),
 manager_employee_id uuid REFERENCES public.hr_employees(id), joining_date date NOT NULL, confirmation_date date,
 exit_date date, employment_status varchar(30) NOT NULL DEFAULT 'ACTIVE', employment_type varchar(50),
 grade varchar(50), cost_center varchar(100), bank_details jsonb NOT NULL DEFAULT '{}'::jsonb,
 statutory_details jsonb NOT NULL DEFAULT '{}'::jsonb, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz, deleted_at timestamptz, is_deleted boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS public.hr_employment_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE, effective_from date NOT NULL, effective_to date,
 action varchar(40) NOT NULL, department_id uuid, position_id uuid, manager_employee_id uuid, grade varchar(50),
 notes text, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid
);
CREATE TABLE IF NOT EXISTS public.hr_shifts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 code varchar(50) NOT NULL, name varchar(100) NOT NULL, start_time time NOT NULL, end_time time NOT NULL,
 break_minutes integer NOT NULL DEFAULT 0, grace_minutes integer NOT NULL DEFAULT 0, overtime_after_minutes integer NOT NULL DEFAULT 0,
 weekly_off_days integer[] NOT NULL DEFAULT '{}', cross_midnight boolean NOT NULL DEFAULT false, status varchar(20) NOT NULL DEFAULT 'ACTIVE',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz, is_deleted boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.hr_employee_shifts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE, shift_id uuid NOT NULL REFERENCES public.hr_shifts(id),
 effective_from date NOT NULL, effective_to date
);
CREATE TABLE IF NOT EXISTS public.hr_holidays (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 holiday_date date NOT NULL, name varchar(150) NOT NULL, branch_id uuid, optional_holiday boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_attendance (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id), attendance_date date NOT NULL, shift_id uuid REFERENCES public.hr_shifts(id),
 check_in timestamptz, check_out timestamptz, break_minutes integer NOT NULL DEFAULT 0, worked_minutes integer NOT NULL DEFAULT 0,
 overtime_minutes integer NOT NULL DEFAULT 0, status varchar(30) NOT NULL DEFAULT 'PRESENT', source varchar(30) NOT NULL DEFAULT 'MANUAL',
 remarks text, finalized boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.hr_attendance_punches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id), punched_at timestamptz NOT NULL, direction varchar(10) NOT NULL,
 source varchar(30) NOT NULL DEFAULT 'MANUAL', device_reference varchar(150), metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_attendance_corrections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id), attendance_date date NOT NULL, requested_check_in timestamptz,
 requested_check_out timestamptz, reason text NOT NULL, status varchar(20) NOT NULL DEFAULT 'PENDING',
 requested_by uuid, approved_by uuid, approved_at timestamptz, workflow_instance_id uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_leave_types (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 code varchar(50) NOT NULL, name varchar(100) NOT NULL, paid boolean NOT NULL DEFAULT true, accrual_method varchar(30) NOT NULL DEFAULT 'NONE',
 annual_entitlement numeric(10,2) NOT NULL DEFAULT 0, carry_forward_limit numeric(10,2) NOT NULL DEFAULT 0,
 expiry_months integer, encashable boolean NOT NULL DEFAULT false, status varchar(20) NOT NULL DEFAULT 'ACTIVE', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_leave_balances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id), leave_type_id uuid NOT NULL REFERENCES public.hr_leave_types(id),
 year integer NOT NULL, opening numeric(10,2) NOT NULL DEFAULT 0, accrued numeric(10,2) NOT NULL DEFAULT 0,
 used numeric(10,2) NOT NULL DEFAULT 0, encashed numeric(10,2) NOT NULL DEFAULT 0, adjusted numeric(10,2) NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.hr_leave_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id), leave_type_id uuid NOT NULL REFERENCES public.hr_leave_types(id),
 start_date date NOT NULL, end_date date NOT NULL, days numeric(10,2) NOT NULL, reason text, status varchar(20) NOT NULL DEFAULT 'PENDING',
 workflow_instance_id uuid, requested_at timestamptz NOT NULL DEFAULT now(), approved_at timestamptz, approved_by uuid, cancelled_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.hr_salary_components (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 code varchar(50) NOT NULL, name varchar(100) NOT NULL, component_type varchar(20) NOT NULL,
 calculation_method varchar(30) NOT NULL DEFAULT 'FIXED', taxable boolean NOT NULL DEFAULT false,
 statutory_code varchar(50), formula jsonb NOT NULL DEFAULT '{}'::jsonb, status varchar(20) NOT NULL DEFAULT 'ACTIVE', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_salary_structures (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 code varchar(50) NOT NULL, name varchar(100) NOT NULL, currency varchar(10) NOT NULL DEFAULT 'INR',
 effective_from date NOT NULL, effective_to date, components jsonb NOT NULL DEFAULT '[]'::jsonb, status varchar(20) NOT NULL DEFAULT 'ACTIVE', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_employee_salary (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id), salary_structure_id uuid NOT NULL REFERENCES public.hr_salary_structures(id),
 effective_from date NOT NULL, effective_to date, gross_monthly numeric(14,2) NOT NULL, currency varchar(10) NOT NULL DEFAULT 'INR',
 component_values jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_payroll_periods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 code varchar(50) NOT NULL, period_start date NOT NULL, period_end date NOT NULL, pay_date date,
 status varchar(20) NOT NULL DEFAULT 'OPEN', currency varchar(10) NOT NULL DEFAULT 'INR',
 workflow_instance_id uuid, created_at timestamptz NOT NULL DEFAULT now(), approved_at timestamptz, closed_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.hr_payroll_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 payroll_period_id uuid NOT NULL REFERENCES public.hr_payroll_periods(id), status varchar(20) NOT NULL DEFAULT 'DRAFT',
 employee_count integer NOT NULL DEFAULT 0, gross_total numeric(16,2) NOT NULL DEFAULT 0, deduction_total numeric(16,2) NOT NULL DEFAULT 0,
 net_total numeric(16,2) NOT NULL DEFAULT 0, finance_posting_reference varchar(150), created_at timestamptz NOT NULL DEFAULT now(),
 calculated_at timestamptz, approved_at timestamptz, closed_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.hr_payslips (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 payroll_run_id uuid NOT NULL REFERENCES public.hr_payroll_runs(id) ON DELETE CASCADE, employee_id uuid NOT NULL REFERENCES public.hr_employees(id),
 gross numeric(14,2) NOT NULL DEFAULT 0, deductions numeric(14,2) NOT NULL DEFAULT 0, net numeric(14,2) NOT NULL DEFAULT 0,
 earnings jsonb NOT NULL DEFAULT '{}'::jsonb, deduction_details jsonb NOT NULL DEFAULT '{}'::jsonb, attendance_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
 status varchar(20) NOT NULL DEFAULT 'DRAFT', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_payroll_adjustments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id), payroll_period_id uuid NOT NULL REFERENCES public.hr_payroll_periods(id),
 adjustment_type varchar(30) NOT NULL, amount numeric(14,2) NOT NULL, description text, approved boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_recruitment_requisitions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 requisition_no varchar(50) NOT NULL, title varchar(150) NOT NULL, department_id uuid REFERENCES public.hr_departments(id), position_id uuid REFERENCES public.hr_positions(id),
 vacancies integer NOT NULL DEFAULT 1, justification text, status varchar(30) NOT NULL DEFAULT 'DRAFT', workflow_instance_id uuid, created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_candidates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 candidate_no varchar(50) NOT NULL, name varchar(200) NOT NULL, email varchar(255), phone varchar(50), resume_document_id uuid,
 source varchar(50), status varchar(30) NOT NULL DEFAULT 'NEW', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 candidate_id uuid NOT NULL REFERENCES public.hr_candidates(id), requisition_id uuid NOT NULL REFERENCES public.hr_recruitment_requisitions(id),
 status varchar(30) NOT NULL DEFAULT 'APPLIED', applied_at timestamptz NOT NULL DEFAULT now(), hired_employee_id uuid REFERENCES public.hr_employees(id)
);
CREATE TABLE IF NOT EXISTS public.hr_interviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 application_id uuid NOT NULL REFERENCES public.hr_applications(id), scheduled_at timestamptz NOT NULL, interview_type varchar(50),
 interviewers jsonb NOT NULL DEFAULT '[]'::jsonb, feedback jsonb NOT NULL DEFAULT '{}', result varchar(30), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_performance_cycles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 code varchar(50) NOT NULL, name varchar(100) NOT NULL, start_date date NOT NULL, end_date date NOT NULL, status varchar(20) NOT NULL DEFAULT 'DRAFT', rating_scale jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_performance_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 cycle_id uuid NOT NULL REFERENCES public.hr_performance_cycles(id), employee_id uuid NOT NULL REFERENCES public.hr_employees(id),
 reviewer_id uuid, goals jsonb NOT NULL DEFAULT '[]', self_assessment jsonb NOT NULL DEFAULT '{}', manager_assessment jsonb NOT NULL DEFAULT '{}',
 rating numeric(6,2), status varchar(20) NOT NULL DEFAULT 'DRAFT', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_training_programs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 code varchar(50) NOT NULL, name varchar(150) NOT NULL, description text, provider varchar(150), duration_hours numeric(8,2),
 certification_required boolean NOT NULL DEFAULT false, expiry_months integer, status varchar(20) NOT NULL DEFAULT 'ACTIVE', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_training_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id), program_id uuid NOT NULL REFERENCES public.hr_training_programs(id),
 scheduled_date date, completion_date date, result varchar(30), certificate_reference varchar(150), expiry_date date, status varchar(20) NOT NULL DEFAULT 'ENROLLED', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_compliance_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid REFERENCES public.hr_employees(id), record_type varchar(50) NOT NULL, title varchar(200) NOT NULL,
 details jsonb NOT NULL DEFAULT '{}', due_date date, completed_at date, status varchar(30) NOT NULL DEFAULT 'OPEN', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_employee_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id), request_type varchar(50) NOT NULL, payload jsonb NOT NULL DEFAULT '{}',
 status varchar(20) NOT NULL DEFAULT 'PENDING', workflow_instance_id uuid, requested_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_hr_employees_tenant_status ON public.hr_employees(tenant_id, employment_status) WHERE is_deleted=false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_employee_no ON public.hr_employees(tenant_id, employee_no) WHERE is_deleted=false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_department_code ON public.hr_departments(tenant_id, code) WHERE is_deleted=false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_position_code ON public.hr_positions(tenant_id, code) WHERE is_deleted=false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_shift_code ON public.hr_shifts(tenant_id, code) WHERE is_deleted=false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_leave_type_code ON public.hr_leave_types(tenant_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_salary_component_code ON public.hr_salary_components(tenant_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_salary_structure_code ON public.hr_salary_structures(tenant_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_attendance_day ON public.hr_attendance(tenant_id, employee_id, attendance_date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_leave_balance ON public.hr_leave_balances(tenant_id, employee_id, leave_type_id, year);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_payroll_period ON public.hr_payroll_periods(tenant_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_payroll_slip ON public.hr_payslips(tenant_id, payroll_run_id, employee_id);

DO $$
DECLARE t text;
BEGIN
 FOR t IN SELECT unnest(ARRAY[
 'hr_departments','hr_positions','hr_employees','hr_employment_history','hr_shifts','hr_employee_shifts','hr_holidays',
 'hr_attendance','hr_attendance_punches','hr_attendance_corrections','hr_leave_types','hr_leave_balances','hr_leave_requests',
 'hr_salary_components','hr_salary_structures','hr_employee_salary','hr_payroll_periods','hr_payroll_runs','hr_payslips',
 'hr_payroll_adjustments','hr_recruitment_requisitions','hr_candidates','hr_applications','hr_interviews','hr_performance_cycles',
 'hr_performance_reviews','hr_training_programs','hr_training_records','hr_compliance_records','hr_employee_requests'
 ]) LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
   EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
   EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_tenant_policy', t);
   EXECUTE format('CREATE POLICY %I ON public.%I USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)', t||'_tenant_policy', t);
 END LOOP;
END $$;

DO $$
DECLARE p text; r text; a text; key text;
BEGIN
 FOR p IN SELECT unnest(ARRAY[
 'employee','department','position','shift','attendance','attendance_correction','leave_type','leave_balance','leave_request',
 'salary_component','salary_structure','employee_salary','payroll_period','payroll_run','payslip','payroll_adjustment',
 'recruitment_requisition','candidate','application','interview','performance_cycle','performance_review','training_program',
 'training_record','compliance','employee_request','analytics'
 ]) LOOP
   FOREACH a IN ARRAY ARRAY['create','read','update','delete'] LOOP
     key := 'hr.'||p||'.'||a;
     r := p;
     INSERT INTO public.permissions(id,module_code,resource,action,scope,permission_key,display_name,description,is_system)
     VALUES(gen_random_uuid(),'hr',r,a,'tenant',key,key,key||' permission',false)
     ON CONFLICT(permission_key) DO UPDATE SET module_code='hr';
   END LOOP;
 END LOOP;
END $$;

INSERT INTO public.permissions(id,module_code,resource,action,scope,permission_key,display_name,description,is_system)
VALUES
(gen_random_uuid(),'hr','employee','grant_access','tenant','hr.employee.grant_access','Grant ERP Access','Grant an employee ERP user access',false),
(gen_random_uuid(),'hr','payroll','calculate','tenant','hr.payroll.calculate','Calculate Payroll','Calculate payroll run',false),
(gen_random_uuid(),'hr','payroll','approve','tenant','hr.payroll.approve','Approve Payroll','Approve payroll run',false),
(gen_random_uuid(),'hr','payroll','close','tenant','hr.payroll.close','Close Payroll','Close payroll period',false)
ON CONFLICT(permission_key) DO UPDATE SET module_code='hr';

COMMIT;
