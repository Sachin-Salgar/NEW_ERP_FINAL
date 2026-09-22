BEGIN;

-- HR lifecycle completion: historical employment, attendance rules, leave lifecycle,
-- recruitment workflow objects, performance, learning, compliance/relations,
-- payroll settlement/posting and statutory declaration records.

CREATE TABLE IF NOT EXISTS hr_employment_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 employee_id uuid NOT NULL, effective_from date NOT NULL, effective_to date,
 change_type varchar(40) NOT NULL, previous_value jsonb NOT NULL DEFAULT '{}'::jsonb,
 new_value jsonb NOT NULL DEFAULT '{}'::jsonb, reason text, created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hr_shift_calendars (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 employee_id uuid, shift_id uuid, calendar_date date NOT NULL, is_weekly_off boolean NOT NULL DEFAULT false,
 holiday_id uuid, planned_start timestamptz, planned_end timestamptz, status varchar(30) NOT NULL DEFAULT 'PLANNED',
 UNIQUE(tenant_id,employee_id,calendar_date)
);
CREATE TABLE IF NOT EXISTS hr_attendance_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 code varchar(50) NOT NULL, name varchar(150) NOT NULL, late_grace_minutes integer NOT NULL DEFAULT 0,
 early_grace_minutes integer NOT NULL DEFAULT 0, overtime_after_minutes integer NOT NULL DEFAULT 0,
 overtime_rounding_minutes integer NOT NULL DEFAULT 1, missing_punch_action varchar(30) NOT NULL DEFAULT 'REGULARIZE',
 status varchar(20) NOT NULL DEFAULT 'ACTIVE', config jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS hr_attendance_regularizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 employee_id uuid NOT NULL, attendance_id uuid, requested_date date NOT NULL, requested_check_in timestamptz,
 requested_check_out timestamptz, reason text NOT NULL, status varchar(30) NOT NULL DEFAULT 'DRAFT',
 approved_by uuid, approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hr_overtime_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 employee_id uuid NOT NULL, attendance_id uuid, work_date date NOT NULL, minutes integer NOT NULL DEFAULT 0,
 rate numeric(14,4) NOT NULL DEFAULT 0, amount numeric(14,2) NOT NULL DEFAULT 0,
 status varchar(30) NOT NULL DEFAULT 'DRAFT', approved_by uuid, approved_at timestamptz
);

CREATE TABLE IF NOT EXISTS hr_leave_accrual_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 year integer NOT NULL, run_date date NOT NULL, status varchar(30) NOT NULL DEFAULT 'COMPLETED',
 carry_forward_applied boolean NOT NULL DEFAULT false, expiry_applied boolean NOT NULL DEFAULT false,
 created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,year,run_date)
);
CREATE TABLE IF NOT EXISTS hr_leave_encashments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 employee_id uuid NOT NULL, leave_type_id uuid NOT NULL, year integer NOT NULL,
 days numeric(12,2) NOT NULL, amount numeric(14,2) NOT NULL DEFAULT 0,
 status varchar(30) NOT NULL DEFAULT 'DRAFT', payroll_period_id uuid, approved_by uuid, approved_at timestamptz
);
CREATE TABLE IF NOT EXISTS hr_leave_cancellations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 leave_request_id uuid NOT NULL, reason text NOT NULL, status varchar(30) NOT NULL DEFAULT 'PENDING',
 approved_by uuid, approved_at timestamptz
);

CREATE TABLE IF NOT EXISTS hr_job_openings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 requisition_id uuid, opening_code varchar(50) NOT NULL, title varchar(200) NOT NULL,
 description text, vacancies integer NOT NULL DEFAULT 1, open_date date, close_date date,
 status varchar(30) NOT NULL DEFAULT 'OPEN', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hr_candidate_screenings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 candidate_id uuid NOT NULL, application_id uuid, screening_date date NOT NULL,
 status varchar(30) NOT NULL DEFAULT 'PENDING', score numeric(8,2), notes text, screened_by uuid
);
CREATE TABLE IF NOT EXISTS hr_interview_evaluations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 interview_id uuid NOT NULL, evaluator_id uuid, score numeric(8,2), recommendation varchar(30),
 strengths text, concerns text, notes text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hr_job_offers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 application_id uuid NOT NULL, offer_no varchar(50) NOT NULL, offered_on date NOT NULL,
 joining_date date, salary numeric(14,2), currency varchar(10), status varchar(30) NOT NULL DEFAULT 'DRAFT',
 terms jsonb NOT NULL DEFAULT '{}'::jsonb, accepted_at timestamptz, rejected_at timestamptz
);

CREATE TABLE IF NOT EXISTS hr_performance_goals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 cycle_id uuid NOT NULL, employee_id uuid NOT NULL, title varchar(250) NOT NULL,
 description text, weight numeric(8,2) NOT NULL DEFAULT 0, target numeric(14,4),
 achievement numeric(14,4), status varchar(30) NOT NULL DEFAULT 'DRAFT'
);
CREATE TABLE IF NOT EXISTS hr_performance_feedback (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 cycle_id uuid NOT NULL, employee_id uuid NOT NULL, reviewer_id uuid NOT NULL,
 feedback_type varchar(30) NOT NULL, comments text, score numeric(8,2)
);
CREATE TABLE IF NOT EXISTS hr_competencies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 code varchar(50) NOT NULL, name varchar(150) NOT NULL, description text, status varchar(20) NOT NULL DEFAULT 'ACTIVE'
);
CREATE TABLE IF NOT EXISTS hr_rating_scales (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 code varchar(50) NOT NULL, name varchar(150) NOT NULL, min_score numeric(8,2) NOT NULL,
 max_score numeric(8,2) NOT NULL, levels jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE TABLE IF NOT EXISTS hr_development_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 employee_id uuid NOT NULL, review_id uuid, title varchar(250) NOT NULL,
 target_date date, actions jsonb NOT NULL DEFAULT '[]'::jsonb, status varchar(30) NOT NULL DEFAULT 'OPEN'
);
CREATE TABLE IF NOT EXISTS hr_promotion_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 employee_id uuid NOT NULL, from_position_id uuid, to_position_id uuid, effective_date date NOT NULL,
 reason text, status varchar(30) NOT NULL DEFAULT 'DRAFT'
);

CREATE TABLE IF NOT EXISTS hr_training_catalog (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 code varchar(50) NOT NULL, name varchar(200) NOT NULL, description text, category varchar(100),
 mandatory boolean NOT NULL DEFAULT false, renewal_months integer, status varchar(20) NOT NULL DEFAULT 'ACTIVE'
);
CREATE TABLE IF NOT EXISTS hr_training_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 program_id uuid, catalog_id uuid, batch_code varchar(50) NOT NULL, start_date date, end_date date,
 capacity integer, location varchar(200), trainer varchar(200), status varchar(30) NOT NULL DEFAULT 'PLANNED'
);
CREATE TABLE IF NOT EXISTS hr_training_enrollments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 batch_id uuid NOT NULL, employee_id uuid NOT NULL, status varchar(30) NOT NULL DEFAULT 'ENROLLED',
 enrolled_at timestamptz NOT NULL DEFAULT now(), attendance_percent numeric(6,2) DEFAULT 0
);
CREATE TABLE IF NOT EXISTS hr_training_assessments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 enrollment_id uuid NOT NULL, assessment_date date, score numeric(8,2), passed boolean, remarks text
);
CREATE TABLE IF NOT EXISTS hr_training_certificates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 enrollment_id uuid NOT NULL, certificate_no varchar(80), issued_on date, expires_on date,
 document_id uuid, status varchar(30) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS hr_policy_acknowledgements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 employee_id uuid NOT NULL, policy_code varchar(80) NOT NULL, acknowledged_at timestamptz,
 status varchar(30) NOT NULL DEFAULT 'PENDING', document_id uuid
);
CREATE TABLE IF NOT EXISTS hr_grievances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 employee_id uuid NOT NULL, grievance_no varchar(60), subject varchar(250) NOT NULL, details text,
 submitted_at timestamptz NOT NULL DEFAULT now(), status varchar(30) NOT NULL DEFAULT 'OPEN', resolution text, resolved_at timestamptz
);
CREATE TABLE IF NOT EXISTS hr_warnings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 employee_id uuid NOT NULL, warning_date date NOT NULL, severity varchar(30), subject varchar(250), details text, status varchar(30) NOT NULL DEFAULT 'ACTIVE'
);
CREATE TABLE IF NOT EXISTS hr_disciplinary_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 employee_id uuid NOT NULL, action_date date NOT NULL, action_type varchar(50), reason text, outcome text, status varchar(30) NOT NULL DEFAULT 'OPEN'
);
CREATE TABLE IF NOT EXISTS hr_investigations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 employee_id uuid, case_no varchar(60), opened_on date NOT NULL, closed_on date, allegation text,
 findings text, status varchar(30) NOT NULL DEFAULT 'OPEN', investigator_id uuid
);
CREATE TABLE IF NOT EXISTS hr_employee_agreements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 employee_id uuid NOT NULL, agreement_type varchar(60) NOT NULL, effective_from date, effective_to date,
 document_id uuid, status varchar(30) NOT NULL DEFAULT 'ACTIVE'
);
CREATE TABLE IF NOT EXISTS hr_compliance_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 employee_id uuid, task_type varchar(80) NOT NULL, due_date date, completed_at timestamptz,
 status varchar(30) NOT NULL DEFAULT 'OPEN', details text
);
CREATE TABLE IF NOT EXISTS hr_exit_interviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 employee_id uuid NOT NULL, exit_record_id uuid, interview_date date, reason text,
 feedback jsonb NOT NULL DEFAULT '{}'::jsonb, eligible_for_rehire boolean, completed_by uuid
);

CREATE TABLE IF NOT EXISTS hr_payroll_statutory_declarations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 employee_id uuid NOT NULL, fiscal_year varchar(20) NOT NULL, declaration_type varchar(60) NOT NULL,
 values jsonb NOT NULL DEFAULT '{}'::jsonb, submitted_at timestamptz, status varchar(30) NOT NULL DEFAULT 'DRAFT'
);
CREATE TABLE IF NOT EXISTS hr_payroll_settlements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 employee_id uuid NOT NULL, exit_record_id uuid, settlement_date date, earnings numeric(14,2) NOT NULL DEFAULT 0,
 deductions numeric(14,2) NOT NULL DEFAULT 0, net_amount numeric(14,2) NOT NULL DEFAULT 0,
 status varchar(30) NOT NULL DEFAULT 'DRAFT', details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS hr_finance_postings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 payroll_run_id uuid NOT NULL, posting_reference varchar(100), posted_at timestamptz,
 status varchar(30) NOT NULL DEFAULT 'PENDING', journal_reference varchar(100), payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY[
 'hr_employment_history','hr_shift_calendars','hr_attendance_rules','hr_attendance_regularizations','hr_overtime_records',
 'hr_leave_accrual_runs','hr_leave_encashments','hr_leave_cancellations','hr_job_openings','hr_candidate_screenings','hr_interview_evaluations','hr_job_offers',
 'hr_performance_goals','hr_performance_feedback','hr_competencies','hr_rating_scales','hr_development_plans','hr_promotion_records',
 'hr_training_catalog','hr_training_batches','hr_training_enrollments','hr_training_assessments','hr_training_certificates',
 'hr_policy_acknowledgements','hr_grievances','hr_warnings','hr_disciplinary_actions','hr_investigations','hr_employee_agreements','hr_compliance_tasks','hr_exit_interviews',
 'hr_payroll_statutory_declarations','hr_payroll_settlements','hr_finance_postings'
 ] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',t||'_tenant_policy',t);
  EXECUTE format('CREATE POLICY %I ON public.%I USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)',t||'_tenant_policy',t);
 END LOOP;
END $$;

DO $$
DECLARE p text; a text;
BEGIN
 FOREACH p IN ARRAY ARRAY[
 'employment_history','shift_calendar','attendance_rule','attendance_regularization','overtime_record',
 'leave_accrual_run','leave_encashment','leave_cancellation','job_opening','candidate_screening','interview_evaluation','job_offer',
 'performance_goal','performance_feedback','competency','rating_scale','development_plan','promotion_record',
 'training_catalog','training_batch','training_enrollment','training_assessment','training_certificate',
 'policy_acknowledgement','grievance','warning','disciplinary_action','investigation','employee_agreement','compliance_task','exit_interview',
 'payroll_statutory_declaration','payroll_settlement','finance_posting'
 ] LOOP
  FOREACH a IN ARRAY ARRAY['create','read','update','delete'] LOOP
   INSERT INTO public.permissions(id,module_code,resource,action,scope,permission_key,display_name,description,is_system)
   VALUES(gen_random_uuid(),'hr',p,a,'tenant','hr.'||p||'.'||a,'HR '||p||' '||a,'HR capability',false)
   ON CONFLICT(permission_key) DO UPDATE SET module_code='hr';
  END LOOP;
 END LOOP;
END $$;

COMMIT;