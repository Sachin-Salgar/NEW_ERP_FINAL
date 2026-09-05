export interface SalesDependencyContext {
  tenantId: string;
  organizationId: string;
  branchId: string;
  financialYearId: string;
  actorUserId: string;
  correlationId: string;
  idempotencyKey: string;
}

export interface CustomerReferencePort {
  assertActiveCustomer(context: SalesDependencyContext, customerId: string): Promise<void>;
}

export type SalesInventoryPort = InventoryDependencyPort;

export interface InventoryReturnPort {
  requestReturnDisposition(
    context: SalesDependencyContext,
    returnId: string,
  ): Promise<{ status: 'NOT_CONNECTED' | 'COMPLETED'; movementId?: string }>;
}

export interface FinancePostingPort {
  submitSalesDocument(context: SalesDependencyContext, documentType: 'INVOICE' | 'CREDIT_NOTE', documentId: string): Promise<{ status: 'NOT_CONNECTED' }>;
}

export interface TaxCalculationPort {
  calculate(context: SalesDependencyContext, documentType: 'INVOICE' | 'CREDIT_NOTE', documentId: string): Promise<{ status: 'NOT_CONNECTED' }>;
}

export interface WorkflowDecisionPort {
  start(context: SalesDependencyContext, documentType: string, documentId: string, versionNumber: number): Promise<{ status: 'NOT_CONNECTED' }>;
  applyDecision(context: SalesDependencyContext, documentType: string, documentId: string, versionNumber: number, decision: string): Promise<{ status: 'NOT_CONNECTED' }>;
}

export interface SalesNotificationPort {
  publish(context: SalesDependencyContext, eventType: string, documentId: string): Promise<{ status: 'NOT_CONNECTED' }>;
}

export interface SalesDocumentPort {
  requestDocument(context: SalesDependencyContext, documentType: string, documentId: string): Promise<{ status: 'NOT_CONNECTED' }>;
}
import type { InventoryDependencyPort } from './inventory.js';
