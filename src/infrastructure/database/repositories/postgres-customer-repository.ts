// @ts-nocheck
import type { Pool } from 'pg';

import type {
  CustomerListQuery,
  CustomerListResult,
  CustomerRecord,
  CustomerRepository,
} from '../../../domain/contracts/repositories.js';
import { withTenantContext } from '../tenant-context.js';

const CUSTOMER_COLUMNS = `
  id, tenant_id AS "tenantId", name, created_at AS "createdAt",
  created_by AS "createdBy", updated_at AS "updatedAt", updated_by AS "updatedBy",
  deleted_at AS "deletedAt", deleted_by AS "deletedBy",
  is_deleted AS "isDeleted", version
`;

export class PostgresCustomerRepository implements CustomerRepository {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey = 'app.current_tenant_id',
  ) {}

  async create(input: { tenantId: string; name: string; actorUserId: string; [key: string]: unknown }): Promise<CustomerRecord> {
    return withTenantContext(this.pool, this.tenantContextKey, input.tenantId, async (client) => {
      const result = await client.query(
        `INSERT INTO customers (tenant_id, name, created_by)
         VALUES ($1, $2, $3) RETURNING ${CUSTOMER_COLUMNS}`,
        [input.tenantId, input.name, input.actorUserId],
      );
      return this.mapRow(result.rows[0]);
    }, { userId: input.actorUserId });
  }

  async getById(tenantId: string, customerIdOrScope: string, maybeCustomerId?: string): Promise<CustomerRecord | null> {
    const customerId = maybeCustomerId ?? customerIdOrScope;
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const result = await client.query(
        `SELECT ${CUSTOMER_COLUMNS} FROM customers
         WHERE tenant_id = $1 AND id = $2 AND is_deleted = false`,
        [tenantId, customerId],
      );
      return result.rows[0] ? this.mapRow(result.rows[0]) : null;
    });
  }

  async list(tenantId: string, query: CustomerListQuery): Promise<CustomerListResult> {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const values: unknown[] = [tenantId];
      const filters = ['tenant_id = $1', 'is_deleted = false'];
      if (query.search) {
        values.push(`%${query.search}%`);
        filters.push(`name ILIKE $${values.length}`);
      }
      const where = filters.join(' AND ');
      const count = await client.query(`SELECT COUNT(*)::int AS count FROM customers WHERE ${where}`, values);
      values.push((query.page - 1) * query.pageSize, query.pageSize);
      const order = query.order === 'desc' ? 'DESC' : 'ASC';
      const rows = await client.query(
        `SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE ${where}
         ORDER BY name ${order}, id ${order}
         OFFSET $${values.length - 1} LIMIT $${values.length}`,
        values,
      );
      return { items: rows.rows.map((row) => this.mapRow(row)), total: Number(count.rows[0]?.count ?? 0) };
    });
  }

  async update(input: { tenantId: string; customerId: string; name: string; actorUserId: string; [key: string]: unknown }) {
    return this.mutateReturning(
      input.tenantId,
      input.actorUserId,
      `UPDATE customers SET name = $1, updated_at = NOW(), updated_by = $2, version = version + 1
       WHERE tenant_id = $3 AND id = $4 AND is_deleted = false RETURNING ${CUSTOMER_COLUMNS}`,
      [input.name, input.actorUserId, input.tenantId, input.customerId],
    );
  }

  async softDelete(input: { tenantId: string; customerId: string; actorUserId: string; [key: string]: unknown }) {
    return this.mutateReturning(
      input.tenantId,
      input.actorUserId,
      `UPDATE customers SET is_deleted = true, deleted_at = NOW(), deleted_by = $1,
       updated_at = NOW(), updated_by = $1, version = version + 1
       WHERE tenant_id = $2 AND id = $3 AND is_deleted = false RETURNING ${CUSTOMER_COLUMNS}`,
      [input.actorUserId, input.tenantId, input.customerId],
    );
  }

  private async mutateReturning(tenantId: string, actorUserId: string, query: string, values: unknown[]) {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const result = await client.query(query, values);
      return result.rows[0] ? this.mapRow(result.rows[0]) : null;
    }, { userId: actorUserId });
  }

  private mapRow(row: Record<string, unknown>): CustomerRecord {
    return {
      id: String(row.id),
      tenantId: String(row.tenantId),
      name: String(row.name),
      createdAt: new Date(String(row.createdAt)),
      createdBy: row.createdBy ? String(row.createdBy) : null,
      updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : null,
      updatedBy: row.updatedBy ? String(row.updatedBy) : null,
      deletedAt: row.deletedAt ? new Date(String(row.deletedAt)) : null,
      deletedBy: row.deletedBy ? String(row.deletedBy) : null,
      isDeleted: Boolean(row.isDeleted),
      version: Number(row.version),
    };
  }
}
