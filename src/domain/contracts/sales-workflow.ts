import type { SalesDependencyContext } from './sales-dependencies.js';

export type SalesWorkflowDecision = 'APPROVE' | 'REJECT' | 'CANCEL';

export interface SalesWorkflowBoundary {
  startApproval(
    context: SalesDependencyContext,
    documentType: string,
    documentId: string,
    versionNumber: number,
  ): Promise<{ status: 'NOT_CONNECTED'; correlationId: string }>;
  applyDecision(
    context: SalesDependencyContext,
    documentType: string,
    documentId: string,
    versionNumber: number,
    decision: SalesWorkflowDecision,
  ): Promise<{ status: 'NOT_CONNECTED'; correlationId: string }>;
}
