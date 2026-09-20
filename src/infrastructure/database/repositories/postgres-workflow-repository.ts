// @ts-nocheck
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { ConflictError, ValidationError } from '../../../domain/errors.js';
import type { ProcurementContext } from '../../../domain/contracts/procurement.js';
import type { WorkflowDefinition, WorkflowDefinitionInput, WorkflowRepository } from '../../../domain/contracts/workflow.js';
import { withTenantContext } from '../tenant-context.js';

export class PostgresWorkflowRepository implements WorkflowRepository {
  constructor(private readonly pool: Pool, private readonly tenantContextKey = 'app.current_tenant_id') {}

  private run<T>(context: ProcurementContext, fn: (db: any) => Promise<T>) {
    return withTenantContext(this.pool, this.tenantContextKey, context.tenantId, fn, { userId: context.userId });
  }

  async createDefinition(input: WorkflowDefinitionInput & { createdBy: string }): Promise<WorkflowDefinition> {
    return this.run({ ...input, financialYearId: randomUUID() }, async (db) => {
      const definition = (await db.query(
        `INSERT INTO workflow_definitions(tenant_id,branch_id,document_type,name,created_by)
         VALUES($1,$2,$3,$4,$5) RETURNING id`,
        [input.tenantId, input.branchId, input.documentType, input.name, input.createdBy],
      )).rows[0];
      const versionNumber = Number((await db.query(
        `SELECT COALESCE(MAX(version),0)+1 AS next_version FROM workflow_definition_versions WHERE workflow_definition_id=$1`,
        [definition.id],
      )).rows[0].next_version);
      const version = (await db.query(
        `INSERT INTO workflow_definition_versions
          (tenant_id,workflow_definition_id,version,status,approval_required,allow_correction,allow_delegation,escalation_after_minutes,definition_json,created_by)
         VALUES($1,$2,$3,'DRAFT',$4,$5,$6,$7,$8::jsonb,$9)
         RETURNING id,version,status,approval_required,allow_correction,allow_delegation,escalation_after_minutes`,
        [input.tenantId, definition.id, versionNumber, input.approvalRequired, input.allowCorrection, input.allowDelegation, input.escalationAfterMinutes ?? null, JSON.stringify(input.levels), input.createdBy],
      )).rows[0];
      return this.map({ ...definition, ...version, tenant_id: input.tenantId, branch_id: input.branchId, document_type: input.documentType, name: input.name });
    });
  }

  async validateDefinition(tenantId: string, versionId: string, actorUserId: string) {
    return this.changeStatus(tenantId, versionId, actorUserId, 'VALIDATED');
  }

  async activateDefinition(tenantId: string, versionId: string, actorUserId: string) {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (db) => {
      const version = (await db.query(
        `SELECT v.*, d.branch_id, d.document_type, d.name
           FROM workflow_definition_versions v JOIN workflow_definitions d ON d.id=v.workflow_definition_id
          WHERE v.id=$1 AND v.tenant_id=$2 AND v.status='VALIDATED' FOR UPDATE`,
        [versionId, tenantId],
      )).rows[0];
      if (!version) return null;
      await db.query(
        `UPDATE workflow_definition_versions SET status='SUPERSEDED',effective_to=now(),updated_at=now()
          WHERE tenant_id=$1 AND status='ACTIVE' AND workflow_definition_id IN
            (SELECT id FROM workflow_definitions WHERE tenant_id=$1 AND branch_id=$3 AND document_type=$4)`,
        [tenantId, version.workflow_definition_id, version.branch_id, version.document_type],
      );
      await db.query(
        `UPDATE workflow_definition_versions SET status='ACTIVE',effective_from=COALESCE(effective_from,now()),updated_by=$3,updated_at=now()
          WHERE id=$1 AND tenant_id=$2`,
        [versionId, tenantId, actorUserId],
      );
      return this.map({ ...version, status: 'ACTIVE' });
    });
  }

  async listDefinitions(tenantId: string, branchId: string, page: number, pageSize: number) {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (db) => {
      const offset = (page - 1) * pageSize;
      const rows = (await db.query(
        `SELECT d.id,d.tenant_id,d.branch_id,d.document_type,d.name,v.id AS version_id,v.version,v.status,
                v.approval_required,v.allow_correction,v.allow_delegation,v.escalation_after_minutes,
                v.effective_from,v.effective_to,v.definition_json
           FROM workflow_definitions d JOIN workflow_definition_versions v ON v.workflow_definition_id=d.id
          WHERE d.tenant_id=$1 AND d.branch_id=$2 ORDER BY d.created_at DESC,v.version DESC LIMIT $3 OFFSET $4`,
        [tenantId, branchId, pageSize, offset],
      )).rows;
      const total = Number((await db.query(`SELECT count(*) FROM workflow_definitions WHERE tenant_id=$1 AND branch_id=$2`, [tenantId, branchId])).rows[0].count);
      return { items: rows.map((row) => this.map(row)), total };
    });
  }

  async getActiveDefinition(tenantId: string, branchId: string, documentType: string) {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (db) => {
      const row = (await db.query(
        `SELECT d.id,d.tenant_id,d.branch_id,d.document_type,d.name,v.id AS version_id,v.version,v.status,
                v.approval_required,v.allow_correction,v.allow_delegation,v.escalation_after_minutes,
                v.effective_from,v.effective_to,v.definition_json
           FROM workflow_definitions d JOIN workflow_definition_versions v ON v.workflow_definition_id=d.id
          WHERE d.tenant_id=$1 AND d.branch_id=$2 AND d.document_type=$3 AND v.status='ACTIVE'
            AND (v.effective_from IS NULL OR v.effective_from <= now())
            AND (v.effective_to IS NULL OR v.effective_to > now()) LIMIT 1`,
        [tenantId, branchId, documentType],
      )).rows[0];
      return row ? this.map(row) : null;
    });
  }

  async createInstance(
    context: ProcurementContext,
    definition: WorkflowDefinition,
    documentType: string,
    documentId: string,
    documentVersion: number,
    operationKey: string,
  ) {
    return this.run(context, async (db) => {
      const existing = (await db.query(`SELECT id,status,version FROM workflow_instances WHERE tenant_id=$1 AND operation_key=$2`, [context.tenantId, operationKey])).rows[0];
      if (existing) return { ...existing, documentType, documentId, documentVersion };
      const instance = (await db.query(
        `INSERT INTO workflow_instances(tenant_id,branch_id,document_type,document_id,definition_version_id,operation_key,status,document_version,version,created_by)
         VALUES($1,$2,$3,$4,$5,$6,'RUNNING',$7,$8,$9) RETURNING id,status,version,document_type AS "documentType",document_id AS "documentId",document_version AS "documentVersion"`,
        [context.tenantId, context.branchId, documentType, documentId, definition.versionId, operationKey, documentVersion, 1, context.userId],
      )).rows[0];
      const levels = definition.levels ?? [];
      for (const level of levels) {
        const levelRow = (await db.query(
         `INSERT INTO workflow_levels(tenant_id,workflow_instance_id,level_number,completion_policy,status,restart_on_correction)
           VALUES($1,$2,$3,$4,'PENDING',$5) RETURNING id`,
         [context.tenantId, instance.id, level.levelNumber, level.completionPolicy, level.restartOnCorrection ?? false],
        )).rows[0];
        for (const approverUserId of level.approverUserIds) {
         await db.query(
           `INSERT INTO workflow_tasks(tenant_id,workflow_instance_id,workflow_level_id,assigned_user_id,status)
             VALUES($1,$2,$3,$4,'PENDING') ON CONFLICT(tenant_id,workflow_level_id,assigned_user_id) DO NOTHING`,
           [context.tenantId, instance.id, levelRow.id, approverUserId],
         );
        }
      }
      if (definition.escalationAfterMinutes) {
        await db.query(
         `INSERT INTO workflow_escalations(tenant_id,workflow_instance_id,due_at)
           VALUES($1,$2,now()+($3 || ' minutes')::interval)
           ON CONFLICT(tenant_id,workflow_instance_id) DO NOTHING`,
         [context.tenantId, instance.id, definition.escalationAfterMinutes],
        );
      }
      return instance;
    });
  }

  async getInstance(context: ProcurementContext, instanceId: string) {
    return this.run(context, async (db) => (await db.query(
      `SELECT i.*,v.version AS definition_version,d.name,
              COALESCE(json_agg(DISTINCT l) FILTER (WHERE l.id IS NOT NULL),'[]') AS levels
         FROM workflow_instances i
         JOIN workflow_definition_versions v ON v.id=i.definition_version_id
         JOIN workflow_definitions d ON d.id=v.workflow_definition_id
         LEFT JOIN workflow_levels l ON l.workflow_instance_id=i.id
        WHERE i.id=$1 AND i.tenant_id=$2 AND i.branch_id=$3 GROUP BY i.id,v.version,d.name`,
      [instanceId, context.tenantId, context.branchId],
    )).rows[0] ?? null);
  }

  async listInstances(context: ProcurementContext, documentType?: string, documentId?: string) {
    return this.run(context, async (db) => (await db.query(
      `SELECT id,document_type AS "documentType",document_id AS "documentId",document_version AS "documentVersion",status,version,created_at AS "createdAt"
         FROM workflow_instances
        WHERE tenant_id=$1 AND branch_id=$2 AND ($3::text IS NULL OR document_type=$3) AND ($4::uuid IS NULL OR document_id=$4)
        ORDER BY created_at DESC`,
      [context.tenantId, context.branchId, documentType ?? null, documentId ?? null],
    )).rows);
  }

  async decide(context: ProcurementContext, instanceId: string, taskId: string, decision: 'APPROVE' | 'REJECT' | 'CORRECTION', expectedVersion: number, operationKey: string) {
    return this.run(context, async (db) => {
      const existing = (await db.query(`SELECT decision FROM workflow_decisions WHERE tenant_id=$1 AND operation_key=$2`, [context.tenantId, operationKey])).rows[0];
      if (existing) return JSON.parse(existing.decision);
      const instance = (await db.query(`SELECT * FROM workflow_instances WHERE id=$1 AND tenant_id=$2 AND branch_id=$3 FOR UPDATE`, [instanceId, context.tenantId, context.branchId])).rows[0];
      if (!instance) throw new ValidationError('Workflow instance not found.');
      if (instance.version !== expectedVersion) throw new ConflictError('Workflow instance was modified concurrently.');
      const task = (await db.query(
        `SELECT t.*,l.completion_policy, l.id AS level_id
           FROM workflow_tasks t JOIN workflow_levels l ON l.id=t.workflow_level_id
          WHERE t.id=$1 AND t.workflow_instance_id=$2
            AND (t.assigned_user_id=$3 OR EXISTS (
              SELECT 1 FROM workflow_delegations d
               WHERE d.task_id=t.id AND d.delegate_user_id=$3
                 AND d.revoked_at IS NULL AND now() BETWEEN d.valid_from AND d.valid_to
            )) FOR UPDATE`,
        [taskId, instanceId, context.userId],
      )).rows[0];
      if (!task) throw new ValidationError('Approval task is not assigned to the authenticated user.');
      if (task.status !== 'PENDING') throw new ConflictError('Approval task has already been decided.');
      const nextStatus = decision === 'REJECT' ? 'REJECTED' : decision === 'CORRECTION' ? 'CORRECTION_REQUESTED' : null;
      if (nextStatus) {
        await db.query(`UPDATE workflow_tasks SET status=$3,decided_at=now(),decided_by=$4 WHERE id=$1 AND tenant_id=$2`, [taskId, context.tenantId, decision === 'REJECT' ? 'REJECTED' : 'CORRECTION_REQUESTED', context.userId]);
        await db.query(`UPDATE workflow_instances SET status=$3,version=version+1,updated_at=now(),updated_by=$4 WHERE id=$1 AND tenant_id=$2`, [instanceId, context.tenantId, nextStatus, context.userId]);
        const result = { status: nextStatus, documentType: instance.document_type, documentId: instance.document_id, documentVersion: instance.document_version, documentStatus: decision === 'REJECT' ? 'REJECTED' : 'DRAFT' };
        await db.query(`INSERT INTO workflow_decisions(tenant_id,workflow_instance_id,task_id,operation_key,decision,result_json,created_by) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`, [context.tenantId, instanceId, taskId, operationKey, decision, JSON.stringify(result), context.userId]);
        return result;
      }
      await db.query(`UPDATE workflow_tasks SET status='APPROVED',decided_at=now(),decided_by=$3 WHERE id=$1 AND tenant_id=$2`, [taskId, context.tenantId, context.userId]);
      const pendingLevel = (await db.query(`SELECT 1 FROM workflow_tasks WHERE workflow_level_id=$1 AND status='PENDING'`, [task.level_id])).rowCount > 0;
      if (task.completion_policy === 'ANY' || !pendingLevel) await db.query(`UPDATE workflow_levels SET status='COMPLETED',completed_at=now() WHERE id=$1`, [task.level_id]);
      const incomplete = (await db.query(`SELECT 1 FROM workflow_levels WHERE workflow_instance_id=$1 AND status <> 'COMPLETED'`, [instanceId])).rowCount > 0;
      const result = incomplete
        ? { status: 'RUNNING' }
        : { status: 'COMPLETED', documentType: instance.document_type, documentId: instance.document_id, documentVersion: instance.document_version, documentStatus: 'APPROVED' };
      await db.query(`UPDATE workflow_instances SET status=$3,version=version+1,updated_at=now(),updated_by=$4 WHERE id=$1 AND tenant_id=$2`, [instanceId, context.tenantId, result.status, context.userId]);
      await db.query(`INSERT INTO workflow_decisions(tenant_id,workflow_instance_id,task_id,operation_key,decision,result_json,created_by) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`, [context.tenantId, instanceId, taskId, operationKey, decision, JSON.stringify(result), context.userId]);
      return result;
    });
  }

  async createDelegation(context: ProcurementContext, input: { taskId: string; delegateUserId: string; validFrom: string; validTo: string }) {
    if (input.delegateUserId === context.userId) throw new ValidationError('A user cannot delegate to themselves.');
    return this.run(context, async (db) => (await db.query(
      `INSERT INTO workflow_delegations(tenant_id,delegator_user_id,delegate_user_id,task_id,valid_from,valid_to)
       SELECT $1,assigned_user_id,$3,$4,$5,$6 FROM workflow_tasks t
        WHERE t.id=$2 AND t.tenant_id=$1 AND t.assigned_user_id=$6
          AND NOT EXISTS (SELECT 1 FROM workflow_delegations d WHERE d.task_id=t.id AND d.revoked_at IS NULL)
          AND NOT EXISTS (SELECT 1 FROM workflow_delegations d WHERE d.delegator_user_id=$6 AND d.revoked_at IS NULL)
       RETURNING id,task_id AS "taskId",delegate_user_id AS "delegateUserId",valid_from AS "validFrom",valid_to AS "validTo"`,
      [context.tenantId, input.taskId, input.delegateUserId, input.validFrom, input.validTo, context.userId],
    )).rows[0] ?? (() => { throw new ValidationError('Delegation is not authorized or already exists.'); })());
  }

  async revokeDelegation(context: ProcurementContext, delegationId: string) {
    return this.run(context, async (db) => (await db.query(`UPDATE workflow_delegations SET revoked_at=now() WHERE id=$1 AND tenant_id=$2 AND revoked_at IS NULL`, [delegationId, context.tenantId])).rowCount === 1);
  }

  async triggerEscalation(context: ProcurementContext, instanceId: string) {
    return this.run(context, async (db) => (await db.query(
      `UPDATE workflow_escalations SET status='TRIGGERED',triggered_at=now(),attempt_count=attempt_count+1
        WHERE tenant_id=$1 AND workflow_instance_id=$2 AND status='PENDING' AND due_at <= now()`,
      [context.tenantId, instanceId],
    )).rowCount === 1);
  }

  private async changeStatus(tenantId: string, versionId: string, actorUserId: string, status: 'VALIDATED') {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (db) => {
      const row = (await db.query(
        `UPDATE workflow_definition_versions SET status=$3,updated_by=$4,updated_at=now()
          WHERE id=$1 AND tenant_id=$2 AND status='DRAFT'
          RETURNING *`,
        [versionId, tenantId, status, actorUserId],
      )).rows[0];
      return row ? this.map(row) : null;
    });
  }

  private map(row: any): WorkflowDefinition {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      documentType: row.document_type,
      name: row.name,
      versionId: row.version_id ?? row.id,
      version: Number(row.version ?? 1),
      status: row.status,
      approvalRequired: row.approval_required ?? true,
      allowCorrection: row.allow_correction ?? false,
      allowDelegation: row.allow_delegation ?? false,
      escalationAfterMinutes: row.escalation_after_minutes === null ? null : Number(row.escalation_after_minutes),
      levels: row.definition_json ?? [],
      effectiveFrom: row.effective_from ?? null,
      effectiveTo: row.effective_to ?? null,
    };
  }
}
