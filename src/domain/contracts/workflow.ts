import type { ProcurementContext } from './procurement.js';

export const WORKFLOW_CONFIGURATION_PERMISSION = 'workflow.configuration.manage';
export const WORKFLOW_MODULE_CODE = 'workflow';

export type WorkflowDefinitionStatus = 'DRAFT' | 'VALIDATED' | 'ACTIVE' | 'SUPERSEDED' | 'RETIRED';
export type WorkflowInstanceStatus = 'RUNNING' | 'COMPLETED' | 'REJECTED' | 'CORRECTION_REQUESTED' | 'CANCELLED';
export type WorkflowLevelPolicy = 'ALL' | 'ANY';

export interface WorkflowLevelInput {
  levelNumber: number;
  completionPolicy: WorkflowLevelPolicy;
  approverUserIds: string[];
  restartOnCorrection?: boolean;
}

export interface WorkflowDefinitionInput {
  tenantId: string;
  branchId: string;
  documentType: string;
  name: string;
  approvalRequired: boolean;
  allowCorrection: boolean;
  allowDelegation: boolean;
  escalationAfterMinutes?: number | null;
  levels: WorkflowLevelInput[];
}

export interface WorkflowDefinition extends WorkflowDefinitionInput {
  id: string;
  versionId: string;
  version: number;
  status: WorkflowDefinitionStatus;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export interface WorkflowRuntimeDocument {
  documentType: string;
  documentId: string;
  documentVersion: number;
}

export interface WorkflowRepository {
  createDefinition(input: WorkflowDefinitionInput & { createdBy: string }): Promise<WorkflowDefinition>;
  validateDefinition(tenantId: string, versionId: string, actorUserId: string): Promise<WorkflowDefinition | null>;
  activateDefinition(tenantId: string, versionId: string, actorUserId: string): Promise<WorkflowDefinition | null>;
  listDefinitions(tenantId: string, branchId: string, page: number, pageSize: number): Promise<{ items: WorkflowDefinition[]; total: number }>;
  getActiveDefinition(tenantId: string, branchId: string, documentType: string): Promise<WorkflowDefinition | null>;
  createInstance(
    context: ProcurementContext,
    definition: WorkflowDefinition,
    documentType: string,
    documentId: string,
    documentVersion: number,
    operationKey: string,
  ): Promise<{ id: string; status: WorkflowInstanceStatus; version: number; documentType: string; documentId: string; documentVersion: number }>;
  getInstance(context: ProcurementContext, instanceId: string): Promise<unknown | null>;
  listInstances(context: ProcurementContext, documentType?: string, documentId?: string): Promise<unknown[]>;
  decide(
    context: ProcurementContext,
    instanceId: string,
    taskId: string,
    decision: 'APPROVE' | 'REJECT' | 'CORRECTION',
    expectedVersion: number,
    operationKey: string,
  ): Promise<{
    status: WorkflowInstanceStatus;
    documentType?: string;
    documentId?: string;
    documentVersion?: number;
    documentStatus?: string;
    alreadyApplied?: boolean;
  }>;
  createDelegation(context: ProcurementContext, input: { taskId: string; delegateUserId: string; validFrom: string; validTo: string }): Promise<unknown>;
  revokeDelegation(context: ProcurementContext, delegationId: string): Promise<boolean>;
  triggerEscalation(context: ProcurementContext, instanceId: string): Promise<boolean>;
}

export interface ProcurementWorkflowPort {
  onDocumentSubmitted(
    context: ProcurementContext,
    documentType: string,
    documentId: string,
    expectedVersion: number,
    operationKey: string,
  ): Promise<{ status: string }>;
  onPurchaseOrderSubmitted(context: ProcurementContext, purchaseOrderId: string, expectedVersion: number, operationKey: string): Promise<{ status: string }>;
  transitionPurchaseOrder(context: ProcurementContext, purchaseOrderId: string, status: 'APPROVED' | 'REJECTED' | 'DRAFT', expectedVersion: number): Promise<unknown>;
}
