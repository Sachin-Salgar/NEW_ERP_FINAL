import type { Pool } from 'pg';

import type {
  AuditLogRecord,
  AuditMetadata,
  AuditQuery,
  AuditQueryResult,
  AuditRepository,
} from '../../../application/contracts/audit.js';
import { withTenantContext } from '../tenant-context.js';

const AUDIT_COLUMNS = `
  id,
  tenant_id AS "tenantId",
  actor_user_id AS "actorUserId",
  action,
  resource_type AS "resourceType",
  resource_id AS "resourceId",
  outcome,
  correlation_id AS "correlationId",
  metadata,
  created_at AS "createdAt"
`;

export class PostgresAuditRepository implements AuditRepository {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey = 'app.current_tenant_id',
  ) {}

  async list(tenantId: string, query: AuditQuery): Promise<AuditQueryResult> {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const values: unknown[] = [tenantId];
      const filters = ['tenant_id = $1'];

      this.addFilter(filters, values, 'actor_user_id =', query.actorUserId);
      this.addFilter(filters, values, 'action =', query.action);
      this.addFilter(filters, values, 'resource_type =', query.resourceType);
      this.addFilter(filters, values, 'resource_id =', query.resourceId);
      this.addFilter(filters, values, 'correlation_id =', query.correlationId);

      if (query.from) {
        values.push(query.from);
        filters.push(`created_at >= $${values.length}`);
      }
      if (query.to) {
        values.push(query.to);
        filters.push(`created_at <= $${values.length}`);
      }

      const where = filters.join(' AND ');
      const count = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM audit_events WHERE ${where}`,
        values,
      );

      const offset = (query.page - 1) * query.pageSize;
      values.push(offset, query.pageSize);
      const direction = query.order === 'asc' ? 'ASC' : 'DESC';
      const rows = await client.query(
        `SELECT ${AUDIT_COLUMNS}
           FROM audit_events
          WHERE ${where}
          ORDER BY created_at ${direction}, id ${direction}
          OFFSET $${values.length - 1}
          LIMIT $${values.length}`,
        values,
      );

      return {
        items: rows.rows.map(mapAuditRow),
        total: Number(count.rows[0]?.count ?? 0),
      };
    });
  }

  private addFilter(filters: string[], values: unknown[], expression: string, value?: string): void {
    if (value === undefined) return;
    values.push(value);
    filters.push(`${expression} $${values.length}`);
  }
}

function mapAuditRow(row: Record<string, unknown>): AuditLogRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenantId),
    actorUserId: (row.actorUserId as string | null | undefined) ?? null,
    action: String(row.action),
    resourceType: String(row.resourceType),
    resourceId: (row.resourceId as string | null | undefined) ?? null,
    outcome: row.outcome as AuditLogRecord['outcome'],
    correlationId: (row.correlationId as string | null | undefined) ?? null,
    metadata: (row.metadata as AuditMetadata | null | undefined) ?? {},
    createdAt: new Date(String(row.createdAt)),
  };
}
