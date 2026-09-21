-- HR capability completion: organization hierarchy, leave policy ledger, payroll inputs/statutory configuration,
-- employee skills/documents/relations and onboarding/exit history.
BEGIN;

CREATE TABLE IF NOT EXISTS public.hr_business_units (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 code varchar(50) NOT NULL, name varchar(150) NOT NULL, legal_entity_reference varchar(100), status varchar(20) NOT NULL DEFAULT 'ACTIVE',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.hr_divisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 code varchar(50) NOT NULL, name varchar(150) NOT NULL, business_unit_id uuid REFERENCES public.hr_business_units(id), branch_id uuid,
 manager_employee_id uuid REFERENCES public.hr_employees(id), status varchar(20) NOT NULL DEFAULT 'ACTIVE', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.hr_sections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 code varchar(50) NOT NULL, name varchar(150) NOT NULL, division_id uuid REFERENCES public.hr_divisions(id), department_id uuid REFERENCES public.hr_departments(id),
 status varchar(20) NOT NULL DEFAULT 'ACTIVE', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.hr_teams (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 code varchar(50) NOT NULL, name varchar(150) NOT NULL, section_id uuid REFERENCES public.hr_sections(id), manager_employee_id uuid REFERENCES public.hr_employees(id),
 status varchar(20) NOT NULL DEFAULT 'ACTIVE', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.hr_employee_skills (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE, skill_code varchar(80) NOT NULL, skill_name varchar(150) NOT NULL,
 proficiency numeric(6,2), acquired_on date, expires_on date, certification_reference varchar(150), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_employee_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE, document_type varchar(80) NOT NULL, document_reference varchar(255) NOT NULL,
 issued_on date, expiry_date date, status varchar(20) NOT NULL DEFAULT 'ACTIVE', metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_employee_relations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE, case_type varchar(60) NOT NULL, subject varchar(200) NOT NULL,
 details jsonb NOT NULL DEFAULT '{}', status varchar(30) NOT NULL DEFAULT 'OPEN', resolution text, created_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.hr_exit_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id), exit_date date NOT NULL, exit_type varchar(40) NOT NULL, reason text,
 notice_period_days integer, final_settlement_status varchar(30) NOT NULL DEFAULT 'PENDING', exit_interview jsonb NOT NULL DEFAULT '{}',
 created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_leave_policies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 leave_type_id uuid NOT NULL REFERENCES public.hr_leave_types(id), name varchar(150) NOT NULL, employment_type varchar(50),
 min_service_days integer NOT NULL DEFAULT 0, max_consecutive_days numeric(10,2), allow_half_day boolean NOT NULL DEFAULT true,
 allow_negative_balance boolean NOT NULL DEFAULT false, approval_workflow_code varchar(100), status varchar(20) NOT NULL DEFAULT 'ACTIVE',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_leave_transactions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id), leave_type_id uuid NOT NULL REFERENCES public.hr_leave_types(id), year integer NOT NULL,
 transaction_type varchar(30) NOT NULL, amount numeric(10,2) NOT NULL, reference_id uuid, reason text, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid
);
CREATE TABLE IF NOT EXISTS public.hr_payroll_loans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id), loan_type varchar(60) NOT NULL, principal numeric(14,2) NOT NULL,
 installment_amount numeric(14,2) NOT NULL, outstanding numeric(14,2) NOT NULL, start_date date NOT NULL, end_date date,
 status varchar(20) NOT NULL DEFAULT 'ACTIVE', approval_workflow_code varchar(100), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_payroll_reimbursements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id), payroll_period_id uuid REFERENCES public.hr_payroll_periods(id), category varchar(80) NOT NULL,
 amount numeric(14,2) NOT NULL, description text, receipt_reference varchar(255), status varchar(20) NOT NULL DEFAULT 'PENDING', workflow_instance_id uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_statutory_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 code varchar(80) NOT NULL, name varchar(150) NOT NULL, jurisdiction varchar(80), rule_type varchar(60) NOT NULL,
 effective_from date NOT NULL, effective_to date, configuration jsonb NOT NULL DEFAULT '{}', status varchar(20) NOT NULL DEFAULT 'ACTIVE', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_onboarding_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id), checklist jsonb NOT NULL DEFAULT '[]', status varchar(30) NOT NULL DEFAULT 'OPEN',
 started_on date, completed_on date, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_business_unit_code ON public.hr_business_units(tenant_id,code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_division_code ON public.hr_divisions(tenant_id,code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_section_code ON public.hr_sections(tenant_id,code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_team_code ON public.hr_teams(tenant_id,code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_statutory_rule ON public.hr_statutory_rules(tenant_id,code,effective_from);
CREATE INDEX IF NOT EXISTS ix_hr_employee_skills_employee ON public.hr_employee_skills(tenant_id,employee_id);
CREATE INDEX IF NOT EXISTS ix_hr_employee_documents_expiry ON public.hr_employee_documents(tenant_id,expiry_date);
CREATE INDEX IF NOT EXISTS ix_hr_leave_transactions_balance ON public.hr_leave_transactions(tenant_id,employee_id,leave_type_id,year);
CREATE INDEX IF NOT EXISTS ix_hr_payroll_loans_employee ON public.hr_payroll_loans(tenant_id,employee_id,status);

DO $$ DECLARE t text;
BEGIN
 FOR t IN SELECT unnest(ARRAY['hr_business_units','hr_divisions','hr_sections','hr_teams','hr_employee_skills','hr_employee_documents','hr_employee_relations','hr_exit_records','hr_leave_policies','hr_leave_transactions','hr_payroll_loans','hr_payroll_reimbursements','hr_statutory_rules','hr_onboarding_records']) LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',t||'_tenant_policy',t);
  EXECUTE format('CREATE POLICY %I ON public.%I USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)',t||'_tenant_policy',t);
 END LOOP;
END $$;

DO $$ DECLARE p text; a text; BEGIN
 FOR p IN SELECT unnest(ARRAY['business_unit','division','section','team','employee_skill','employee_document','employee_relation','exit_record','leave_policy','leave_transaction','payroll_loan','payroll_reimbursement','statutory_rule','onboarding']) LOOP
  FOREACH a IN ARRAY ARRAY['create','read','update','delete'] LOOP
   INSERT INTO public.permissions(id,module_code,resource,action,scope,permission_key,display_name,description,is_system)
   VALUES(gen_random_uuid(),'hr',p,a,'tenant','hr.'||p||'.'||a,'HR '||p||' '||a,'HR permission',false)
   ON CONFLICT(permission_key) DO UPDATE SET module_code='hr';
  END LOOP;
 END LOOP;
END $$;
COMMIT;
