import type { Pool } from 'pg';
import type { FinanceContext, FinancePostingPort, FinancePostingResult } from '../../../domain/contracts/finance.js';
import { withTenantContext } from '../tenant-context.js';
import { ValidationError } from '../../../domain/errors.js';

export class PostgresFinanceRepository implements FinancePostingPort {
  constructor(private readonly pool: Pool, private readonly key = 'app.current_tenant_id') {}
  async postSalesDocument(c: FinanceContext, documentType: 'INVOICE' | 'CREDIT_NOTE', documentId: string, amount: number, idempotencyKey: string): Promise<FinancePostingResult> {
    return withTenantContext(this.pool, this.key, c.tenantId, async connection => {
      const reference = `${documentType === 'INVOICE' ? 'AR' : 'CR'}-${documentId}`;
      const inserted = await connection.query(`INSERT INTO finance_postings(tenant_id,organization_id,branch_id,financial_year_id,document_type,document_id,reference,amount,idempotency_key,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (tenant_id,organization_id,branch_id,financial_year_id,idempotency_key) DO NOTHING RETURNING document_type,document_id,reference,amount::float8 AS amount`, [c.tenantId,c.organizationId,c.branchId,c.financialYearId,documentType,documentId,reference,amount,idempotencyKey,c.userId]);
      const existing = inserted.rows[0] ?? (await connection.query(`SELECT document_type,document_id,reference,amount::float8 AS amount FROM finance_postings WHERE tenant_id=$1 AND organization_id=$2 AND branch_id=$3 AND financial_year_id=$4 AND idempotency_key=$5`, [c.tenantId,c.organizationId,c.branchId,c.financialYearId,idempotencyKey])).rows[0];
      if (!existing) throw new ValidationError('Finance posting could not be resolved after an idempotent write.');
      if (existing.document_type !== documentType || existing.document_id !== documentId || Number(existing.amount) !== amount) throw new ValidationError('Finance idempotency key is already used for a different posting.');
      return { reference: existing.reference, status: 'POSTED', amount: Number(existing.amount) };
    }, { organizationId: c.organizationId, userId: c.userId });
  }
}
