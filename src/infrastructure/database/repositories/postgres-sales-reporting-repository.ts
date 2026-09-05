import type { Pool } from 'pg';
import { withTenantContext } from '../tenant-context.js';
import type {
  SalesDocumentSummary,
  SalesReportRepository,
} from '../../../domain/contracts/sales-reporting.js';

type SummaryRow = {
  documentType: SalesDocumentSummary['documentType'];
  documentId: string;
  documentNumber: string;
  status: string;
  customerId: string;
  createdAt: Date;
  versionNumber: number;
};

const SUMMARY_COLUMNS = `
  document_type AS "documentType",
  document_id AS "documentId",
  document_number AS "documentNumber",
  status,
  customer_id AS "customerId",
  created_at AS "createdAt",
  version_number AS "versionNumber"
`;

export class PostgresSalesReportingRepository implements SalesReportRepository {
  constructor(private readonly pool: Pool, private readonly tenantContextKey = 'app.current_tenant_id') {}

  async listDocumentSummary(
    context: { tenantId: string; organizationId: string; branchId: string; financialYearId: string },
    input: { page: number; pageSize: number; order: 'asc' | 'desc'; search?: string },
  ): Promise<{ items: SalesDocumentSummary[]; total: number }> {
    return withTenantContext(this.pool, this.tenantContextKey, context.tenantId, async (client) => {
      const filters = [
        'tenant_id = $1',
        'organization_id = $2',
        'branch_id = $3',
        'financial_year_id = $4',
      ];
      const values: unknown[] = [
        context.tenantId,
        context.organizationId,
        context.branchId,
        context.financialYearId,
      ];
      if (input.search?.trim()) {
        values.push(`%${input.search.trim()}%`);
        filters.push(`document_number ILIKE $${values.length}`);
      }
      const where = filters.join(' AND ');
      const count = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM (
          SELECT tenant_id, organization_id, branch_id, financial_year_id, invoice_number AS document_number
          FROM sales_invoices
          UNION ALL
          SELECT tenant_id, organization_id, branch_id, financial_year_id, return_number
          FROM sales_returns
          UNION ALL
          SELECT tenant_id, organization_id, branch_id, financial_year_id, credit_note_number
          FROM sales_credit_notes
        ) documents WHERE ${where}`,
        values,
      );
      const direction = input.order === 'desc' ? 'DESC' : 'ASC';
      const offset = (input.page - 1) * input.pageSize;
      const pageValues = [...values, offset, input.pageSize];
      const rows = await client.query<SummaryRow>(
        `SELECT ${SUMMARY_COLUMNS} FROM (
          SELECT 'INVOICE'::text AS document_type, id AS document_id, invoice_number AS document_number,
                 status::text, customer_id, created_at, version_number,
                 tenant_id, organization_id, branch_id, financial_year_id
          FROM sales_invoices
          UNION ALL
          SELECT 'RETURN'::text, id, return_number, status::text, customer_id, created_at, version_number,
                 tenant_id, organization_id, branch_id, financial_year_id
          FROM sales_returns
          UNION ALL
          SELECT 'CREDIT_NOTE'::text, id, credit_note_number, status::text, customer_id, created_at, version_number,
                 tenant_id, organization_id, branch_id, financial_year_id
          FROM sales_credit_notes
        ) documents
        WHERE ${where}
        ORDER BY document_number ${direction}, document_id ${direction}
        OFFSET $${pageValues.length - 1} LIMIT $${pageValues.length}`,
        pageValues,
      );
      return {
        items: rows.rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt) })),
        total: Number(count.rows[0]?.count ?? 0),
      };
    }, { organizationId: context.organizationId });
  }
}
