export const SALES_REPORTING_PERMISSIONS = {
  read: 'sales.reporting.read',
} as const;

export interface SalesReportContext {
  tenantId: string;
  organizationId: string;
  branchId: string;
  financialYearId: string;
  userId: string;
}

export type SalesReportDocumentType =
  | 'QUOTATION'
  | 'ORDER'
  | 'DELIVERY'
  | 'INVOICE'
  | 'RETURN'
  | 'CREDIT_NOTE';

export interface SalesDocumentSummary {
  documentType: SalesReportDocumentType;
  documentId: string;
  documentNumber: string;
  status: string;
  customerId: string;
  createdAt: Date;
  versionNumber: number;
}

export interface SalesReportRepository {
  listDocumentSummary(
    context: Omit<SalesReportContext, 'userId'>,
    input: { page: number; pageSize: number; order: 'asc' | 'desc'; search?: string },
  ): Promise<{ items: SalesDocumentSummary[]; total: number }>;
}
