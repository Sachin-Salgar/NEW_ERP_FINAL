import { NotFoundError, ValidationError } from '../../domain/errors.js';
import {
  type ProcurementWorkflowPort,
  type WorkflowDefinitionInput,
  type WorkflowRepository,
} from '../../domain/contracts/workflow.js';
import type { AuditLogger } from '../contracts/audit.js';
import type { NotificationServicePort, SchedulerServicePort } from '../contracts/operational-services.js';
import type { ProcurementContext } from '../../domain/contracts/procurement.js';

export class WorkflowService implements ProcurementWorkflowPort {
  constructor(
    private readonly repository: WorkflowRepository,
    private readonly audit: AuditLogger,
    private readonly tx: { runInTransaction<T>(callback: () => Promise<T>): Promise<T> },
    private readonly procurement: {
      transitionPurchaseOrder: (context: ProcurementContext, input: { id: string; status: string; expectedVersion: number }) => Promise<unknown>;
      transitionPurchaseOrderFromWorkflow?: (
        context: ProcurementContext,
        input: { id: string; status: 'APPROVED' | 'REJECTED' | 'DRAFT'; expectedVersion: number },
      ) => Promise<unknown>;
    },
    private readonly notifications?: NotificationServicePort,
    private readonly scheduler?: SchedulerServicePort,
  ) {
    this.documentHandlers = new Map();
  }

  private readonly documentHandlers: Map<string, (context: ProcurementContext, documentId: string, status: 'APPROVED' | 'REJECTED' | 'CORRECTION') => Promise<unknown>>;

  registerDocumentHandler(documentType: string, handler: (context: ProcurementContext, documentId: string, status: 'APPROVED' | 'REJECTED' | 'CORRECTION') => Promise<unknown>) {
    this.documentHandlers.set(documentType, handler);
  }

  async createDefinition(context: ProcurementContext, input: Omit<WorkflowDefinitionInput, 'tenantId' | 'branchId'>) {
    if (input.approvalRequired && input.levels.length === 0) throw new ValidationError('Approval-required workflows need at least one approval level.');
    const definition = await this.repository.createDefinition({ ...input, tenantId: context.tenantId, branchId: context.branchId, createdBy: context.userId });
    await this.audit.record({ tenantId: context.tenantId, actorUserId: context.userId, action: 'workflow.definition.created', resourceType: 'workflow_definition', resourceId: definition.id, outcome: 'success' });
    return definition;
  }

  async validateDefinition(context: ProcurementContext, versionId: string) {
    const definition = await this.repository.validateDefinition(context.tenantId, versionId, context.userId);
    if (!definition) throw new NotFoundError('Workflow definition version not found.');
    return definition;
  }

  async activateDefinition(context: ProcurementContext, versionId: string) {
    const definition = await this.repository.activateDefinition(context.tenantId, versionId, context.userId);
    if (!definition) throw new ValidationError('Only a validated workflow definition can be activated.');
    await this.audit.record({ tenantId: context.tenantId, actorUserId: context.userId, action: 'workflow.configuration.activated', resourceType: 'workflow_definition_version', resourceId: versionId, outcome: 'success' });
    return definition;
  }

  async listDefinitions(context: ProcurementContext, page: number, pageSize: number) {
    return this.repository.listDefinitions(context.tenantId, context.branchId, page, pageSize);
  }

  async onDocumentSubmitted(
    context: ProcurementContext,
    documentType: string,
    documentId: string,
    expectedVersion: number,
    operationKey: string,
  ) {
    const definition = await this.repository.getActiveDefinition(context.tenantId, context.branchId, documentType);
    if (!definition) {
      return { status: 'SUBMITTED' };
    }
    if (!definition.approvalRequired) {
      const handler = this.documentHandlers.get(documentType);
      if (handler) await handler(context, documentId, 'APPROVED');
      else await this.transitionPurchaseOrderFromWorkflow(context, { id: documentId, status: 'APPROVED', expectedVersion });
      return { status: 'APPROVED' };
    }
    const instance = await this.repository.createInstance(context, definition, documentType, documentId, expectedVersion, operationKey);
    if (this.scheduler && definition.escalationAfterMinutes) {
      await this.scheduler.schedule({
        tenantId: context.tenantId,
        jobType: 'workflow.escalation',
        payload: { workflowInstanceId: instance.id, branchId: context.branchId, documentType, documentId },
        scheduleKind: 'once',
        nextRunAt: new Date(Date.now() + definition.escalationAfterMinutes * 60_000),
        maxAttempts: 5,
      });
    }
    await this.audit.record({ tenantId: context.tenantId, actorUserId: context.userId, action: 'workflow.submitted', resourceType: 'workflow_instance', resourceId: instance.id, outcome: 'success' });
    return { status: instance.status };
  }

  async onPurchaseOrderSubmitted(context: ProcurementContext, purchaseOrderId: string, expectedVersion: number, operationKey: string) {
    return this.onDocumentSubmitted(context, 'PURCHASE_ORDER', purchaseOrderId, expectedVersion, operationKey);
  }

  async transitionPurchaseOrder(context: ProcurementContext, purchaseOrderId: string, status: 'APPROVED' | 'REJECTED' | 'DRAFT', expectedVersion: number) {
    return this.procurement.transitionPurchaseOrder(context, { id: purchaseOrderId, status, expectedVersion });
  }

  async getInstance(context: ProcurementContext, id: string) {
    const value = await this.repository.getInstance(context, id);
    if (!value) throw new NotFoundError('Workflow instance not found.');
    return value;
  }

  async listInstances(context: ProcurementContext, documentType?: string, documentId?: string) {
    return this.repository.listInstances(context, documentType, documentId);
  }

  async decideDocument(
    context: ProcurementContext,
    instanceId: string,
    taskId: string,
    decision: 'APPROVE' | 'REJECT' | 'CORRECTION',
    expectedVersion: number,
    operationKey: string,
  ) {
    const result = await this.tx.runInTransaction(async () => {
      const decisionResult = await this.repository.decide(context, instanceId, taskId, decision, expectedVersion, operationKey);
      if (decisionResult.documentStatus && decisionResult.documentId && decisionResult.documentVersion) {
        const handler = this.documentHandlers.get(decisionResult.documentType ?? '');
        if (handler) {
          const status = decisionResult.documentStatus as 'APPROVED' | 'REJECTED' | 'CORRECTION';
          await handler(context, decisionResult.documentId, status);
        } else {
          await this.transitionPurchaseOrderFromWorkflow(context, { id: decisionResult.documentId, status: decisionResult.documentStatus as 'APPROVED' | 'REJECTED' | 'DRAFT', expectedVersion: decisionResult.documentVersion });
        }
      }

      return decisionResult;
    });
    await this.audit.record({ tenantId: context.tenantId, actorUserId: context.userId, action: `workflow.${decision.toLowerCase()}`, resourceType: 'workflow_instance', resourceId: instanceId, outcome: 'success' }, { requireTransaction: false });
    if (this.notifications && result.documentStatus) {
      await this.notifications.enqueue({
        tenantId: context.tenantId,
        channel: 'in_app',
        templateKey: `workflow.${decision.toLowerCase()}`,
        payload: {
          workflowInstanceId: instanceId,
          ...(result.documentType ? { documentType: result.documentType } : {}),
          ...(result.documentStatus ? { status: result.documentStatus } : {}),
        },
      });
    }
    return result;
  }

  private transitionPurchaseOrderFromWorkflow(
    context: ProcurementContext,
    input: { id: string; status: 'APPROVED' | 'REJECTED' | 'DRAFT'; expectedVersion: number },
  ) {
    return this.procurement.transitionPurchaseOrderFromWorkflow
      ? this.procurement.transitionPurchaseOrderFromWorkflow(context, input)
      : this.procurement.transitionPurchaseOrder
        ? this.procurement.transitionPurchaseOrder(context, input)
        : Promise.reject(new ValidationError('Workflow procurement transition is not configured.'));
  }

  async decide(context: ProcurementContext, instanceId: string, taskId: string, decision: 'APPROVE' | 'REJECT' | 'CORRECTION', expectedVersion: number, operationKey: string) {
    return this.decideDocument(context, instanceId, taskId, decision, expectedVersion, operationKey);
  }

  async createDelegation(context: ProcurementContext, input: { taskId: string; delegateUserId: string; validFrom: string; validTo: string }) {
    const validFrom = Date.parse(input.validFrom);
    const validTo = Date.parse(input.validTo);
    if (!Number.isFinite(validFrom) || !Number.isFinite(validTo) || validTo <= validFrom)
      throw new ValidationError('Delegation validity period is invalid.');
    return this.repository.createDelegation(context, input);
  }

  async revokeDelegation(context: ProcurementContext, delegationId: string) {
    return this.repository.revokeDelegation(context, delegationId);
  }

  async triggerEscalation(context: ProcurementContext, instanceId: string) {
    return this.repository.triggerEscalation(context, instanceId);
  }

}
