// @ts-nocheck
import type { Pool } from 'pg';

import type { ItemListQuery, ItemRecord, ItemRepository } from '../../../domain/contracts/repositories.js';
import { withTenantContext } from '../tenant-context.js';

const ITEM_COLUMNS = `
  id,
  tenant_id AS "tenantId",
  
  code,
  name,
  description,
  unit_of_measure AS "unitOfMeasure",
  sales_eligible AS "salesEligible",
  status,
  created_at AS "createdAt",
  created_by AS "createdBy",
  updated_at AS "updatedAt",
  updated_by AS "updatedBy",
  deleted_at AS "deletedAt",
  deleted_by AS "deletedBy",
  is_deleted AS "isDeleted",
  version
`;

export class PostgresItemMasterRepository implements ItemRepository {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey = 'app.current_tenant_id',
  ) {}

  async create(input: {
    tenantId: string;
    code: string;
    name: string;
    description: string | null;
    unitOfMeasure: string;
    salesEligible: boolean;
    actorUserId: string;
  }): Promise<ItemRecord> {
    return withTenantContext(
      this.pool,
      this.tenantContextKey,
      input.tenantId,
      async (client) => {
        const result = await client.query(
          `INSERT INTO inventory_items
          (tenant_id,  code, name, description, unit_of_measure, sales_eligible, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING ${ITEM_COLUMNS}`,
          [
            input.tenantId,
            input.code,
            input.name,
            input.description,
            input.unitOfMeasure,
            input.salesEligible,
            input.actorUserId,
          ],
        );
        return this.mapRow(result.rows[0]);
      },
      { userId: input.actorUserId },
    );
  }

  async getById(tenantId: string, itemId: string): Promise<ItemRecord | null> {
    return withTenantContext(
      this.pool,
      this.tenantContextKey,
      tenantId,
      async (client) => {
        const result = await client.query(
          `SELECT ${ITEM_COLUMNS} FROM inventory_items
          WHERE tenant_id = $1 AND id = $2 AND is_deleted = false`,
          [tenantId, itemId],
        );
        return result.rows[0] ? this.mapRow(result.rows[0]) : null;
      },
      {},
    );
  }

  async list(tenantId: string, query: ItemListQuery): Promise<{ items: ItemRecord[]; total: number }> {
    return withTenantContext(
      this.pool,
      this.tenantContextKey,
      tenantId,
      async (client) => {
        const values: unknown[] = [tenantId];
        const filters = ['tenant_id = $1', 'is_deleted = false'];
        if (query.search) {
          values.push(`%${query.search}%`);
          filters.push(`(code ILIKE $${values.length} OR name ILIKE $${values.length})`);
        }
        const count = await client.query(
          `SELECT COUNT(*)::int AS count FROM inventory_items WHERE ${filters.join(' AND ')}`,
          values,
        );
        values.push((query.page - 1) * query.pageSize, query.pageSize);
        const order = query.order === 'desc' ? 'DESC' : 'ASC';
        const result = await client.query(
          `SELECT ${ITEM_COLUMNS} FROM inventory_items
          WHERE ${filters.join(' AND ')}
          ORDER BY name ${order}, id ${order}
          OFFSET $${values.length - 1} LIMIT $${values.length}`,
          values,
        );
        return { items: result.rows.map((row) => this.mapRow(row)), total: Number(count.rows[0]?.count ?? 0) };
      },
      {},
    );
  }

  async update(input: {
    tenantId: string;
    itemId: string;
    name: string;
    description: string | null;
    unitOfMeasure: string;
    salesEligible: boolean;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<ItemRecord | null> {
    return this.mutate(
      input.tenantId,
      input.actorUserId,
      `UPDATE inventory_items
          SET name=$1, description=$2, unit_of_measure=$3, sales_eligible=$4,
              updated_at=NOW(), updated_by=$5, version=version+1
        WHERE tenant_id=$6 AND id=$7 AND is_deleted=false AND version=$8
        RETURNING ${ITEM_COLUMNS}`,
      [
        input.name,
        input.description,
        input.unitOfMeasure,
        input.salesEligible,
        input.actorUserId,
        input.tenantId,
        input.itemId,
        input.expectedVersion,
      ],
    );
  }

  async softDelete(input: {
    tenantId: string;
    itemId: string;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<ItemRecord | null> {
    return this.mutate(
      input.tenantId,
      input.actorUserId,
      `UPDATE inventory_items
          SET is_deleted=true, deleted_at=NOW(), deleted_by=$1, updated_at=NOW(), updated_by=$1, version=version+1
        WHERE tenant_id=$2 AND id=$3 AND is_deleted=false AND version=$4
        RETURNING ${ITEM_COLUMNS}`,
      [input.actorUserId, input.tenantId, input.itemId, input.expectedVersion],
    );
  }

  private async mutate(
    tenantId: string,
    actorUserId: string,
    query: string,
    values: unknown[],
  ) {
    return withTenantContext(
      this.pool,
      this.tenantContextKey,
      tenantId,
      async (client) => {
        const result = await client.query(query, values);
        return result.rows[0] ? this.mapRow(result.rows[0]) : null;
      },
      { userId: actorUserId },
    );
  }

  private mapRow(row: Record<string, unknown>): ItemRecord {
    return {
      id: String(row.id),
      tenantId: String(row.tenantId),
      code: String(row.code),
      name: String(row.name),
      description: row.description ? String(row.description) : null,
      unitOfMeasure: String(row.unitOfMeasure),
      salesEligible: Boolean(row.salesEligible),
      status: String(row.status) as ItemRecord['status'],
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
