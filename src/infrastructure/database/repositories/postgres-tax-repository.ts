import type { Pool } from 'pg';
import type { TaxRepository } from '../../../domain/contracts/tax.js';
import { withTenantContext } from '../tenant-context.js';

const C = `id,tenant_id AS "tenantId",organization_id AS "organizationId",code,name,rate::float8 AS rate,status,effective_from::text AS "effectiveFrom",effective_to::text AS "effectiveTo",version_number AS "versionNumber",created_at AS "createdAt",updated_at AS "updatedAt"`;
export class PostgresTaxRepository implements TaxRepository {
  constructor(private readonly pool: Pool, private readonly key = 'app.current_tenant_id') {}
  async create(i: any) { return withTenantContext(this.pool, this.key, i.tenantId, async c => { const r = await c.query(`INSERT INTO tax_rules(tenant_id,organization_id,code,name,rate,effective_from,effective_to,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${C}`, [i.tenantId,i.organizationId,i.code,i.name,i.rate,i.effectiveFrom,i.effectiveTo,i.userId]); return this.map(r.rows[0]); }, { organizationId: i.organizationId, userId: i.userId }); }
  async list(t: string, o: string) { return withTenantContext(this.pool, this.key, t, async c => (await c.query(`SELECT ${C} FROM tax_rules WHERE tenant_id=$1 AND organization_id=$2 ORDER BY code,id`, [t,o])).rows.map(r => this.map(r)), { organizationId: o }); }
  async update(i: any) { return this.mutate(i, `UPDATE tax_rules SET name=$1,rate=$2,effective_to=$3,updated_at=now(),updated_by=$4,version_number=version_number+1 WHERE tenant_id=$5 AND organization_id=$6 AND id=$7 AND version_number=$8 RETURNING ${C}`, [i.name,i.rate,i.effectiveTo,i.userId,i.tenantId,i.organizationId,i.id,i.expectedVersion]); }
  async setStatus(i: any) { return this.mutate(i, `UPDATE tax_rules SET status=$1,updated_at=now(),updated_by=$2,version_number=version_number+1 WHERE tenant_id=$3 AND organization_id=$4 AND id=$5 AND version_number=$6 RETURNING ${C}`, [i.status,i.userId,i.tenantId,i.organizationId,i.id,i.expectedVersion]); }
  async resolve(i: any) { return withTenantContext(this.pool, this.key, i.tenantId, async c => { const r = await c.query(`SELECT ${C} FROM tax_rules WHERE tenant_id=$1 AND organization_id=$2 AND status='ACTIVE' AND effective_from<= $3::date AND (effective_to IS NULL OR effective_to >= $3::date) ORDER BY effective_from DESC, id`, [i.tenantId,i.organizationId,i.asOf]); return r.rows.length === 1 ? this.map(r.rows[0]) : r.rows.length > 1 ? (() => { throw new Error('Ambiguous active tax rules for effective date.'); })() : null; }, { organizationId: i.organizationId, userId: i.userId }); }
  private async mutate(i: any, sql: string, values: any[]) { return withTenantContext(this.pool, this.key, i.tenantId, async c => { const r = await c.query(sql, values); return r.rows[0] ? this.map(r.rows[0]) : null; }, { organizationId: i.organizationId, userId: i.userId }); }
  private map(r: any) { return { ...r, rate: Number(r.rate), createdAt: new Date(r.createdAt), updatedAt: r.updatedAt ? new Date(r.updatedAt) : null }; }
}
