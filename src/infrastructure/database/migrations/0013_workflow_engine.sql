CREATE TABLE public.workflow_definitions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 branch_id uuid,
 code varchar(120) NOT NULL,
 name varchar(255) NOT NULL,
 document_type varchar(120) NOT NULL,
 action varchar(80) NOT NULL,
 version integer NOT NULL DEFAULT 1,
 status varchar(20) NOT NULL DEFAULT 'DRAFT',
 steps jsonb NOT NULL DEFAULT '[]'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid, updated_at timestamptz, updated_by uuid,
 CONSTRAINT workflow_definition_status CHECK(status IN ('DRAFT','PUBLISHED','RETIRED')),
 CONSTRAINT workflow_definition_steps_array CHECK(jsonb_typeof(steps)='array')
);
ALTER TABLE public.workflow_definitions ADD CONSTRAINT fk_workflow_definition_branch_tenant FOREIGN KEY(branch_id,tenant_id) REFERENCES public.branches(id,tenant_id);
CREATE UNIQUE INDEX uq_workflow_definition_version ON public.workflow_definitions(tenant_id,code,version);
CREATE UNIQUE INDEX uq_workflow_definition_published ON public.workflow_definitions(tenant_id,branch_id,document_type,action) WHERE status='PUBLISHED';
CREATE UNIQUE INDEX uq_workflow_definition_id_tenant ON public.workflow_definitions(id,tenant_id);

CREATE TABLE public.workflow_instances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 branch_id uuid NOT NULL,
 definition_id uuid NOT NULL,
 definition_version integer NOT NULL,
 document_type varchar(120) NOT NULL,
 document_id uuid NOT NULL,
 action varchar(80) NOT NULL,
 document_version integer NOT NULL,
 initiator_user_id uuid NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'PENDING',
 current_step integer NOT NULL DEFAULT 1,
 operation_key varchar(180) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 CONSTRAINT workflow_instance_status CHECK(status IN ('PENDING','APPROVED','REJECTED','RETURNED','CANCELLED')),
 CONSTRAINT workflow_instance_step CHECK(current_step>0)
);
ALTER TABLE public.workflow_instances ADD CONSTRAINT fk_workflow_instance_branch_tenant FOREIGN KEY(branch_id,tenant_id) REFERENCES public.branches(id,tenant_id);
ALTER TABLE public.workflow_instances ADD CONSTRAINT fk_workflow_instance_definition_tenant FOREIGN KEY(definition_id,tenant_id) REFERENCES public.workflow_definitions(id,tenant_id);
CREATE UNIQUE INDEX uq_workflow_instance_operation ON public.workflow_instances(tenant_id,operation_key);
CREATE UNIQUE INDEX uq_workflow_instance_id_tenant ON public.workflow_instances(id,tenant_id);
CREATE INDEX idx_workflow_instance_document ON public.workflow_instances(tenant_id,document_type,document_id,status);

CREATE TABLE public.workflow_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 branch_id uuid NOT NULL,
 workflow_instance_id uuid NOT NULL,
 step_no integer NOT NULL,
 assignee_role_id uuid NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'PENDING',
 required_approvals integer NOT NULL DEFAULT 1,
 approval_count integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 CONSTRAINT workflow_task_status CHECK(status IN ('PENDING','APPROVED','REJECTED','RETURNED','CANCELLED')),
 CONSTRAINT workflow_task_approval CHECK(required_approvals>0 AND approval_count>=0 AND approval_count<=required_approvals)
);
ALTER TABLE public.workflow_tasks ADD CONSTRAINT fk_workflow_task_branch_tenant FOREIGN KEY(branch_id,tenant_id) REFERENCES public.branches(id,tenant_id);
ALTER TABLE public.workflow_tasks ADD CONSTRAINT fk_workflow_task_instance_tenant FOREIGN KEY(workflow_instance_id,tenant_id) REFERENCES public.workflow_instances(id,tenant_id);
ALTER TABLE public.workflow_tasks ADD CONSTRAINT fk_workflow_task_role_tenant FOREIGN KEY(assignee_role_id,tenant_id) REFERENCES public.roles(id,tenant_id);
CREATE UNIQUE INDEX uq_workflow_task_step ON public.workflow_tasks(tenant_id,workflow_instance_id,step_no);
CREATE UNIQUE INDEX uq_workflow_task_id_tenant ON public.workflow_tasks(id,tenant_id);
CREATE INDEX idx_workflow_task_user_lookup ON public.workflow_tasks(tenant_id,assignee_role_id,status);

CREATE TABLE public.workflow_decisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 branch_id uuid NOT NULL,
 workflow_task_id uuid NOT NULL,
 actor_user_id uuid NOT NULL,
 decision varchar(20) NOT NULL,
 comments text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT workflow_decision_type CHECK(decision IN ('APPROVE','REJECT','RETURN'))
);
ALTER TABLE public.workflow_decisions ADD CONSTRAINT fk_workflow_decision_branch_tenant FOREIGN KEY(branch_id,tenant_id) REFERENCES public.branches(id,tenant_id);
ALTER TABLE public.workflow_decisions ADD CONSTRAINT fk_workflow_decision_task_tenant FOREIGN KEY(workflow_task_id,tenant_id) REFERENCES public.workflow_tasks(id,tenant_id);
CREATE UNIQUE INDEX uq_workflow_decision_actor_task ON public.workflow_decisions(tenant_id,workflow_task_id,actor_user_id);
CREATE UNIQUE INDEX uq_workflow_decision_id_tenant ON public.workflow_decisions(id,tenant_id);

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['workflow_definitions','workflow_instances','workflow_tasks','workflow_decisions'] LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
   EXECUTE format('CREATE POLICY %I ON public.%I USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)',t||'_tenant_policy',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',t);
   EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO erp_app',t);
 END LOOP;
END $$;