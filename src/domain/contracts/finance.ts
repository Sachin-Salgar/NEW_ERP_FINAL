export interface FinanceContext { tenantId: string; organizationId: string; branchId: string; financialYearId: string; userId: string; }
export interface FinancePostingResult { reference: string; status: 'POSTED'; amount: number; }
export interface FinancePostingPort {
  postSalesDocument(context: FinanceContext, documentType: 'INVOICE' | 'CREDIT_NOTE', documentId: string, amount: number, idempotencyKey: string): Promise<FinancePostingResult>;
}
