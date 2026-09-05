import type { Pool } from 'pg';
import type { QuotationRepository, QuotationRecord } from '../../../domain/contracts/repositories.js';
import { withTenantContext } from '../tenant-context.js';
import { ValidationError } from '../../../domain/errors.js';

const C = `id,tenant_id AS "tenantId",organization_id AS "organizationId",branch_id AS "branchId",financial_year_id AS "financialYearId",quotation_number AS "quotationNumber",customer_id AS "customerId",quotation_date AS "quotationDate",valid_until AS "validUntil",status,notes,created_at AS "createdAt",created_by AS "createdBy",updated_at AS "updatedAt",updated_by AS "updatedBy",deleted_at AS "deletedAt",deleted_by AS "deletedBy",is_deleted AS "isDeleted",version_number AS "versionNumber"`;
export class PostgresQuotationRepository implements QuotationRepository {
  constructor(
    private readonly pool: Pool,
    private readonly key = 'app.current_tenant_id',
  ) {}
  async create(i: any): Promise<QuotationRecord> {
    return (await withTenantContext(
      this.pool,
      this.key,
      i.tenantId,
      async (c) => {
        const customer = await c.query(
          'SELECT 1 FROM customers WHERE id=$1 AND tenant_id=$2 AND organization_id=$3 AND is_deleted=false',
          [i.customerId, i.tenantId, i.organizationId],
        );
        if (!customer.rows[0]) throw new ValidationError('Customer must belong to the active organization.');
        const n = await c.query(
          `INSERT INTO code_counters(tenant_id,entity_type,scope_key,last_value) VALUES($1,'sales_quotation',$2,1) ON CONFLICT(tenant_id,entity_type,scope_key) DO UPDATE SET last_value=code_counters.last_value+1 RETURNING last_value`,
          [i.tenantId, i.organizationId],
        );
        const number = `Q-${String(n.rows[0].last_value).padStart(6, '0')}`;
        const q = await c.query(
          `INSERT INTO sales_quotations(tenant_id,organization_id,branch_id,financial_year_id,quotation_number,customer_id,quotation_date,valid_until,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${C}`,
          [
            i.tenantId,
            i.organizationId,
            i.branchId,
            i.financialYearId,
            number,
            i.customerId,
            i.quotationDate,
            i.validUntil,
            i.notes ?? null,
            i.actorUserId,
          ],
        );
        await this.replaceItems(c, q.rows[0].id, i);
        return this.getOn(c, i.tenantId, i.organizationId, i.branchId, i.financialYearId, q.rows[0].id);
      },
      { organizationId: i.organizationId, userId: i.actorUserId },
    ))!;
  }
  async getById(t: string, o: string, b: string, fy: string, id: string) {
    return withTenantContext(this.pool, this.key, t, (c) => this.getOn(c, t, o, b, fy, id), { organizationId: o });
  }
  async list(t: string, q: any) {
    return withTenantContext(
      this.pool,
      this.key,
      t,
      async (c) => {
        const vals: any[] = [t, q.organizationId, q.branchId, q.financialYearId],
          f = ['tenant_id=$1', 'organization_id=$2', 'branch_id=$3', 'financial_year_id=$4', 'is_deleted=false'];
        if (q.search) {
          vals.push(`%${q.search}%`);
          f.push(
            `(quotation_number ILIKE $${vals.length} OR status::text ILIKE $${vals.length} OR customer_id IN (SELECT id FROM customers WHERE name ILIKE $${vals.length}) )`,
          );
        }
        const count = await c.query(`SELECT count(*)::int count FROM sales_quotations WHERE ${f.join(' AND ')}`, vals);
        vals.push((q.page - 1) * q.pageSize, q.pageSize);
        const ord = q.order === 'desc' ? 'DESC' : 'ASC';
        const rows = await c.query(
          `SELECT ${C} FROM sales_quotations WHERE ${f.join(' AND ')} ORDER BY quotation_number ${ord},id ${ord} OFFSET $${vals.length - 1} LIMIT $${vals.length}`,
          vals,
        );
        return { items: await Promise.all(rows.rows.map((r) => this.map(c, r))), total: Number(count.rows[0].count) };
      },
      { organizationId: q.organizationId },
    );
  }
  async update(i: any) {
    return withTenantContext(
      this.pool,
      this.key,
      i.tenantId,
      async (c) => {
        const customer = await c.query(
          'SELECT 1 FROM customers WHERE id=$1 AND tenant_id=$2 AND organization_id=$3 AND is_deleted=false',
          [i.customerId, i.tenantId, i.organizationId],
        );
        if (!customer.rows[0]) throw new ValidationError('Customer must belong to the active organization.');
        const r = await c.query(
          `UPDATE sales_quotations SET customer_id=$1,quotation_date=$2,valid_until=$3,notes=$4,updated_at=now(),updated_by=$5,version_number=version_number+1 WHERE tenant_id=$6 AND organization_id=$7 AND branch_id=$8 AND financial_year_id=$9 AND id=$10 AND status='DRAFT' AND is_deleted=false RETURNING ${C}`,
          [
            i.customerId,
            i.quotationDate,
            i.validUntil,
            i.notes ?? null,
            i.actorUserId,
            i.tenantId,
            i.organizationId,
            i.branchId,
            i.financialYearId,
            i.quotationId,
          ],
        );
        if (!r.rows[0]) return null;
        await this.replaceItems(c, i.quotationId, i);
        return this.getOn(c, i.tenantId, i.organizationId, i.branchId, i.financialYearId, i.quotationId);
      },
      { organizationId: i.organizationId, userId: i.actorUserId },
    );
  }
  async transition(i: any) {
    return this.mutate(
      i,
      `UPDATE sales_quotations SET status=$1,updated_at=now(),updated_by=$2,version_number=version_number+1 WHERE tenant_id=$3 AND organization_id=$4 AND branch_id=$5 AND financial_year_id=$6 AND id=$7 AND is_deleted=false RETURNING ${C}`,
      [i.status, i.actorUserId, i.tenantId, i.organizationId, i.branchId, i.financialYearId, i.quotationId],
    );
  }
  async softDelete(i: any) {
    return this.mutate(
      i,
      `UPDATE sales_quotations SET is_deleted=true,deleted_at=now(),deleted_by=$1,updated_at=now(),updated_by=$1,version_number=version_number+1 WHERE tenant_id=$2 AND organization_id=$3 AND branch_id=$4 AND financial_year_id=$5 AND id=$6 AND status='DRAFT' AND is_deleted=false RETURNING ${C}`,
      [i.actorUserId, i.tenantId, i.organizationId, i.branchId, i.financialYearId, i.quotationId],
    );
  }
  private async mutate(i: any, sql: string, v: any[]) {
    return withTenantContext(
      this.pool,
      this.key,
      i.tenantId,
      async (c) => {
        const r = await c.query(sql, v);
        return r.rows[0] ? this.map(c, r.rows[0]) : null;
      },
      { organizationId: i.organizationId, userId: i.actorUserId },
    );
  }
  private async getOn(c: any, t: string, o: string, b: string, fy: string, id: string) {
    const r = await c.query(
      `SELECT ${C} FROM sales_quotations WHERE tenant_id=$1 AND organization_id=$2 AND branch_id=$3 AND financial_year_id=$4 AND id=$5 AND is_deleted=false`,
      [t, o, b, fy, id],
    );
    return r.rows[0] ? this.map(c, r.rows[0]) : null;
  }
  private async map(c: any, r: any): Promise<QuotationRecord> {
    const items = await c.query(
      `SELECT id,item_id AS "itemId",line_number AS "lineNumber",description,quantity,unit_price AS "unitPrice",unit_of_measure AS "unitOfMeasure",created_at AS "createdAt",created_by AS "createdBy",updated_at AS "updatedAt",updated_by AS "updatedBy",version_number AS "versionNumber" FROM sales_quotation_items WHERE quotation_id=$1 AND tenant_id=$2 AND organization_id=$3 AND branch_id=$4 AND financial_year_id=$5 ORDER BY line_number`,
      [r.id, r.tenantId, r.organizationId, r.branchId, r.financialYearId],
    );
    return {
      ...r,
      quotationDate: new Date(r.quotationDate),
      validUntil: new Date(r.validUntil),
      createdAt: new Date(r.createdAt),
      updatedAt: r.updatedAt ? new Date(r.updatedAt) : null,
      deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
      items: items.rows.map((x: any) => ({ ...x, quantity: Number(x.quantity), unitPrice: Number(x.unitPrice) })),
    };
  }
  private async replaceItems(c: any, id: string, i: any) {
    await c.query('DELETE FROM sales_quotation_items WHERE quotation_id=$1', [id]);
    for (let n = 0; n < i.items.length; n++) {
      const x = i.items[n];
      await c.query(
        `INSERT INTO sales_quotation_items(tenant_id,organization_id,branch_id,financial_year_id,quotation_id,item_id,line_number,description,quantity,unit_price,unit_of_measure,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
        [
          i.tenantId,
          i.organizationId,
          i.branchId,
          i.financialYearId,
          id,
          x.itemId ?? null,
          n + 1,
          x.description.trim(),
          x.quantity,
          x.unitPrice,
          x.unitOfMeasure.trim(),
          i.actorUserId,
        ],
      );
    }
  }
}
