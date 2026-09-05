import type { Pool } from 'pg';
import { withTenantContext } from '../tenant-context.js';
import type {
  DiscountCreateInput,
  DiscountRuleRecord,
  DiscountRuleRepository,
  DiscountTransitionInput,
  DiscountUpdateInput,
  ResolvedDiscountRule,
} from '../../../domain/contracts/discount.js';
import { ValidationError } from '../../../domain/errors.js';

const C = `id,tenant_id AS "tenantId",organization_id AS "organizationId",code,name,percentage,
effective_from AS "effectiveFrom",effective_to AS "effectiveTo",status,
version_number AS "versionNumber",created_at AS "createdAt",updated_at AS "updatedAt"`;

function mapRule(row: Record<string, unknown>): DiscountRuleRecord {
  return {
    ...row,
    percentage: Number(row.percentage),
    createdAt: new Date(String(row.createdAt)),
    updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : null,
  } as DiscountRuleRecord;
}

export class PostgresDiscountRepository implements DiscountRuleRepository {
  constructor(private readonly pool: Pool, private readonly tenantContextKey = 'app.current_tenant_id') {}

  async create(input: DiscountCreateInput): Promise<DiscountRuleRecord> {
    return withTenantContext(this.pool, this.tenantContextKey, input.tenantId, async (client) => {
      const result = await client.query(`INSERT INTO sales_discount_rules
        (tenant_id,organization_id,code,name,percentage,effective_from,effective_to,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${C}`,
        [input.tenantId, input.organizationId, input.code, input.name, input.percentage,
          input.effectiveFrom, input.effectiveTo, input.actorUserId]);
      return mapRule(result.rows[0]);
    }, { organizationId: input.organizationId, userId: input.actorUserId }) as Promise<DiscountRuleRecord>;
  }

  async list(tenantId: string, organizationId: string): Promise<DiscountRuleRecord[]> {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const result = await client.query(`SELECT ${C} FROM sales_discount_rules
        WHERE tenant_id=$1 AND organization_id=$2 ORDER BY code`, [tenantId, organizationId]);
      return result.rows.map(mapRule);
    }, { organizationId }) as Promise<DiscountRuleRecord[]>;
  }

  async resolve(tenantId: string, organizationId: string, asOf: string): Promise<ResolvedDiscountRule | null> {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const result = await client.query(`SELECT id,code,percentage,effective_from AS "effectiveFrom",
        effective_to AS "effectiveTo",version_number AS "versionNumber"
        FROM sales_discount_rules
        WHERE tenant_id=$1 AND organization_id=$2 AND status='PUBLISHED'
          AND effective_from <= $3::date
          AND (effective_to IS NULL OR effective_to >= $3::date)
        ORDER BY effective_from DESC, code ASC`, [tenantId, organizationId, asOf]);
      const first = result.rows[0];
      if (first && result.rows[1] && String(first.effectiveFrom) === String(result.rows[1].effectiveFrom)) {
        throw new ValidationError('Multiple published discount rules are applicable for the effective date.');
      }
      return first ? {
        id: String(first.id),
        code: String(first.code),
        percentage: Number(first.percentage),
        effectiveFrom: String(first.effectiveFrom),
        effectiveTo: first.effectiveTo ? String(first.effectiveTo) : null,
        versionNumber: Number(first.versionNumber),
      } : null;
    }, { organizationId }) as Promise<ResolvedDiscountRule | null>;
  }

  async transition(input: DiscountTransitionInput): Promise<DiscountRuleRecord | null> {
    return withTenantContext(this.pool, this.tenantContextKey, input.tenantId, async (client) => {
      const result = await client.query(`UPDATE sales_discount_rules
        SET status=$1::sales_discount_status_enum,updated_at=now(),updated_by=$2,version_number=version_number+1
        WHERE tenant_id=$3 AND organization_id=$4 AND id=$5 AND version_number=$6
          AND ((status='DRAFT' AND $1='PUBLISHED') OR (status='PUBLISHED' AND $1='ARCHIVED'))
        RETURNING ${C}`,
        [input.status, input.actorUserId, input.tenantId, input.organizationId, input.id, input.expectedVersion]);
      return result.rows[0] ? mapRule(result.rows[0]) : null;
    }, { organizationId: input.organizationId, userId: input.actorUserId }) as Promise<DiscountRuleRecord | null>;
  }

  async update(input: DiscountUpdateInput): Promise<DiscountRuleRecord | null> {
    return withTenantContext(this.pool, this.tenantContextKey, input.tenantId, async (client) => {
      const result = await client.query(`UPDATE sales_discount_rules
        SET name=$1,percentage=$2,effective_from=$3,effective_to=$4,updated_at=now(),
            updated_by=$5,version_number=version_number+1
        WHERE tenant_id=$6 AND organization_id=$7 AND id=$8 AND status='DRAFT'
          AND version_number=$9
        RETURNING ${C}`,
        [input.name, input.percentage, input.effectiveFrom, input.effectiveTo, input.actorUserId,
          input.tenantId, input.organizationId, input.id, input.expectedVersion]);
      return result.rows[0] ? mapRule(result.rows[0]) : null;
    }, { organizationId: input.organizationId, userId: input.actorUserId }) as Promise<DiscountRuleRecord | null>;
  }
}
