import type { Pool } from 'pg';
import type { FinanceContext, FinancePostingPort, FinancePostingResult } from '../../../domain/contracts/finance.js';
import { withTenantContext } from '../tenant-context.js';

export class PostgresFinanceRepository implements FinancePostingPort {
  constructor(private readonly pool: Pool, private readonly key = 'app.current_tenant_id') {}
  async postSalesDocument(c: FinanceContext, documentType: 'INVOICE' | 'CREDIT_NOTE', documentId: string, amount: number, idempotencyKey: string): Promise<FinancePostingResult> {
    return withTenantContext(this.pool, this.key, c.tenantId, async connection => {
      const existing = await connection.query(`SELECT reference,amount::float8 AS amount FROM finance_postings WHERE tenant_id=$1 AND organization_id=$2 AND branch_id=$3 AND financial_year_id=$4 AND idempotency_key=$5`, [c.tenantId,c.organizationId,c.branchId,c.financialYearId,idempotencyKey]);
      if (existing.rows[0]) return { reference: existing.rows[0].reference, status: 'POSTED', amount: Number(existing.rows[0].amount) };
      const reference = `${documentType === 'INVOICE' ? 'AR' : 'CR'}-${documentId}`;
      const result = await connection.query(`INSERT INTO finance_postings(tenant_id,organization_id,branch_id,financial_year_id,document_type,document_id,reference,amount,idempotency_key,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING reference,amount::float8 AS amount`, [c.tenantId,c.organizationId,c.branchId,c.financialYearId,documentType,documentId,reference,amount,idempotencyKey,c.userId]);
      return { reference: result.rows[0].reference, status: 'POSTED', amount: Number(result.rows[0].amount) };
    }, { organizationId: c.organizationId, userId: c.userId });
  }
}
