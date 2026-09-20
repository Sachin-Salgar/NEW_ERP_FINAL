SET search_path = public;

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  branch_id uuid NOT NULL,
  document_type varchar(64) NOT NULL,
  name varchar(150) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (tenant_id, branch_id, document_type, name),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS workflow_definition_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  workflow_definition_id uuid NOT NULL REFERENCES workflow_definitions(id),
  version integer NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('DRAFT','VALIDATED','ACTIVE','SUPERSEDED','RETIRED')),
  approval_required boolean NOT NULL,
  allow_correction boolean NOT NULL DEFAULT false,
  allow_delegation boolean NOT NULL DEFAULT false,
  escalation_after_minutes integer CHECK (escalation_after_minutes IS NULL OR escalation_after_minutes > 0),
  definition_json jsonb NOT NULL,
  effective_from timestamptz,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  UNIQUE (workflow_definition_id, version),
  UNIQUE (tenant_id, workflow_definition_id, id),
  UNIQUE (tenant_id, id),
  CONSTRAINT workflow_definition_versions_tenant_fk
    FOREIGN KEY (tenant_id, workflow_definition_id) REFERENCES workflow_definitions(tenant_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS workflow_one_active_branch_document
  ON workflow_definition_versions(tenant_id, workflow_definition_id)
  WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS workflow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  branch_id uuid NOT NULL,
  document_type varchar(64) NOT NULL,
  document_id uuid NOT NULL,
  definition_version_id uuid NOT NULL REFERENCES workflow_definition_versions(id),
  operation_key varchar(128) NOT NULL,
  status varchar(32) NOT NULL CHECK (status IN ('RUNNING','COMPLETED','REJECTED','CORRECTION_REQUESTED','CANCELLED')),
  document_version integer NOT NULL DEFAULT 1,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  UNIQUE (tenant_id, operation_key),
  UNIQUE (tenant_id, id),
  CONSTRAINT workflow_instances_definition_tenant_fk
    FOREIGN KEY (tenant_id, definition_version_id) REFERENCES workflow_definition_versions(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS workflow_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  workflow_instance_id uuid NOT NULL REFERENCES workflow_instances(id),
  level_number integer NOT NULL CHECK (level_number > 0),
  completion_policy varchar(8) NOT NULL CHECK (completion_policy IN ('ALL','ANY')),
  status varchar(20) NOT NULL CHECK (status IN ('PENDING','COMPLETED','RESTARTED')),
  restart_on_correction boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  UNIQUE (tenant_id, workflow_instance_id, level_number),
  UNIQUE (tenant_id, id),
  CONSTRAINT workflow_levels_instance_tenant_fk
    FOREIGN KEY (tenant_id, workflow_instance_id) REFERENCES workflow_instances(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS workflow_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  workflow_instance_id uuid NOT NULL REFERENCES workflow_instances(id),
  workflow_level_id uuid NOT NULL REFERENCES workflow_levels(id),
  assigned_user_id uuid NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED','CORRECTION_REQUESTED')),
  decided_at timestamptz,
  decided_by uuid,
  UNIQUE (tenant_id, workflow_level_id, assigned_user_id),
  UNIQUE (tenant_id, id),
  CONSTRAINT workflow_tasks_instance_tenant_fk
    FOREIGN KEY (tenant_id, workflow_instance_id) REFERENCES workflow_instances(tenant_id, id),
  CONSTRAINT workflow_tasks_level_tenant_fk
    FOREIGN KEY (tenant_id, workflow_level_id) REFERENCES workflow_levels(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS workflow_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  workflow_instance_id uuid NOT NULL REFERENCES workflow_instances(id),
  task_id uuid NOT NULL REFERENCES workflow_tasks(id),
  operation_key varchar(128) NOT NULL,
  decision varchar(20) NOT NULL,
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (tenant_id, operation_key),
  CONSTRAINT workflow_decisions_instance_tenant_fk
    FOREIGN KEY (tenant_id, workflow_instance_id) REFERENCES workflow_instances(tenant_id, id),
  CONSTRAINT workflow_decisions_task_tenant_fk
    FOREIGN KEY (tenant_id, task_id) REFERENCES workflow_tasks(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS workflow_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  delegator_user_id uuid NOT NULL,
  delegate_user_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES workflow_tasks(id),
  valid_from timestamptz NOT NULL,
  valid_to timestamptz NOT NULL CHECK (valid_to > valid_from),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (delegator_user_id <> delegate_user_id),
  CONSTRAINT workflow_delegations_task_tenant_fk
    FOREIGN KEY (tenant_id, task_id) REFERENCES workflow_tasks(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS workflow_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  workflow_instance_id uuid NOT NULL REFERENCES workflow_instances(id),
  due_at timestamptz NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','TRIGGERED','CANCELLED')),
  attempt_count integer NOT NULL DEFAULT 0,
  triggered_at timestamptz,
  UNIQUE (tenant_id, workflow_instance_id),
  CONSTRAINT workflow_escalations_instance_tenant_fk
    FOREIGN KEY (tenant_id, workflow_instance_id) REFERENCES workflow_instances(tenant_id, id)
);

CREATE INDEX IF NOT EXISTS workflow_instances_document_idx ON workflow_instances(tenant_id, branch_id, document_type, document_id);
CREATE INDEX IF NOT EXISTS workflow_tasks_assignee_idx ON workflow_tasks(tenant_id, assigned_user_id, status);
CREATE INDEX IF NOT EXISTS workflow_escalations_due_idx ON workflow_escalations(tenant_id, status, due_at);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['workflow_definitions','workflow_definition_versions','workflow_instances','workflow_levels','workflow_tasks','workflow_decisions','workflow_delegations','workflow_escalations'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_policy', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)', t || '_tenant_policy', t);
  END LOOP;
END $$;
