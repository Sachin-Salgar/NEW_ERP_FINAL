import type { Pool, PoolClient } from 'pg';
import type {
  InventoryMovementRecord,
  InventoryRepository,
  InventoryReservationRecord,
  InventoryStockRecord,
  WarehouseRecord,
} from '../../../domain/contracts/repositories.js';
import { ValidationError } from '../../../domain/errors.js';
import { withTenantContext } from '../tenant-context.js';

const warehouseColumns = `id, tenant_id AS "tenantId", organization_id AS "organizationId",
  code, name, status, version, created_at AS "createdAt", created_by AS "createdBy",
  updated_at AS "updatedAt", updated_by AS "updatedBy"`;
const stockColumns = `id, tenant_id AS "tenantId", organization_id AS "organizationId",
  warehouse_id AS "warehouseId", item_id AS "itemId", on_hand_quantity AS "onHandQuantity",
  reserved_quantity AS "reservedQuantity", on_hand_quantity - reserved_quantity AS "availableQuantity", version`;
const reservationColumns = `id, tenant_id AS "tenantId", organization_id AS "organizationId",
  branch_id AS "branchId", financial_year_id AS "financialYearId", warehouse_id AS "warehouseId",
  item_id AS "itemId", source_type AS "sourceType", source_id AS "sourceId",
  idempotency_key AS "idempotencyKey", quantity, status, version, created_at AS "createdAt",
  created_by AS "createdBy", updated_at AS "updatedAt", updated_by AS "updatedBy"`;
const movementColumns = `id, tenant_id AS "tenantId", organization_id AS "organizationId",
  branch_id AS "branchId", financial_year_id AS "financialYearId", warehouse_id AS "warehouseId",
  item_id AS "itemId", movement_type AS "movementType", quantity, source_type AS "sourceType",
  source_id AS "sourceId", operation_key AS "operationKey", created_at AS "createdAt", created_by AS "createdBy"`;

export class PostgresInventoryRepository implements InventoryRepository {
  constructor(private readonly pool: Pool, private readonly tenantContextKey = 'app.current_tenant_id') {}

  async createWarehouse(input: { tenantId: string; organizationId: string; code: string; name: string; actorUserId: string }) {
    return this.withTenant(input.tenantId, input.organizationId, input.actorUserId, async (client) => {
      const result = await client.query(
        `INSERT INTO inventory_warehouses
          (tenant_id, organization_id, code, name, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$5) RETURNING ${warehouseColumns}`,
        [input.tenantId, input.organizationId, input.code, input.name, input.actorUserId],
      );
      return this.mapWarehouse(result.rows[0]);
    });
  }

  async listWarehouses(tenantId: string, organizationId: string, page: number, pageSize: number, search?: string) {
    return this.withTenant(tenantId, organizationId, undefined, async (client) => {
      const values: unknown[] = [tenantId, organizationId];
      const filters = ['tenant_id=$1', 'organization_id=$2'];
      if (search) {
        values.push(`%${search}%`);
        filters.push(`(code ILIKE $${values.length} OR name ILIKE $${values.length})`);
      }
      const count = await client.query(`SELECT count(*)::int AS count FROM inventory_warehouses WHERE ${filters.join(' AND ')}`, values);
      values.push((page - 1) * pageSize, pageSize);
      const rows = await client.query(
        `SELECT ${warehouseColumns} FROM inventory_warehouses WHERE ${filters.join(' AND ')}
         ORDER BY name ASC, id ASC OFFSET $${values.length - 1} LIMIT $${values.length}`,
        values,
      );
      return { items: rows.rows.map((row) => this.mapWarehouse(row)), total: Number(count.rows[0].count) };
    });
  }

  async updateWarehouse(input: {
    tenantId: string; organizationId: string; warehouseId: string; name: string; status: 'ACTIVE' | 'INACTIVE';
    expectedVersion: number; actorUserId: string;
  }) {
    return this.withTenant(input.tenantId, input.organizationId, input.actorUserId, async (client) => {
      const result = await client.query(
        `UPDATE inventory_warehouses SET name=$1,status=$2,updated_at=now(),updated_by=$3,version=version+1
         WHERE tenant_id=$4 AND organization_id=$5 AND id=$6 AND version=$7
         RETURNING ${warehouseColumns}`,
        [input.name, input.status, input.actorUserId, input.tenantId, input.organizationId, input.warehouseId, input.expectedVersion],
      );
      return result.rows[0] ? this.mapWarehouse(result.rows[0]) : null;
    });
  }

  async listStock(tenantId: string, organizationId: string, page: number, pageSize: number, warehouseId?: string, itemId?: string) {
    return this.withTenant(tenantId, organizationId, undefined, async (client) => {
      const values: unknown[] = [tenantId, organizationId];
      const filters = ['tenant_id=$1', 'organization_id=$2'];
      if (warehouseId) { values.push(warehouseId); filters.push(`warehouse_id=$${values.length}`); }
      if (itemId) { values.push(itemId); filters.push(`item_id=$${values.length}`); }
      const count = await client.query(`SELECT count(*)::int AS count FROM inventory_stock WHERE ${filters.join(' AND ')}`, values);
      values.push((page - 1) * pageSize, pageSize);
      const rows = await client.query(
        `SELECT ${stockColumns} FROM inventory_stock WHERE ${filters.join(' AND ')}
         ORDER BY warehouse_id ASC, item_id ASC OFFSET $${values.length - 1} LIMIT $${values.length}`,
        values,
      );
      return { items: rows.rows.map((row) => this.mapStock(row)), total: Number(count.rows[0].count) };
    });
  }

  async receiveStock(input: {
    tenantId: string; organizationId: string; branchId: string; financialYearId: string; warehouseId: string;
    itemId: string; quantity: number; sourceType: string; sourceId: string; operationKey: string; actorUserId: string;
  }) {
    return this.withTenant(input.tenantId, input.organizationId, input.actorUserId, async (client) => {
      const existing = await this.findMovement(client, input);
      if (existing) return this.stockFor(client, input);
      await this.assertWarehouseAndItem(client, input);
      await this.ensureStock(client, input);
      await client.query(
        `UPDATE inventory_stock SET on_hand_quantity=on_hand_quantity+$1,updated_at=now(),updated_by=$2,version=version+1
         WHERE tenant_id=$3 AND organization_id=$4 AND warehouse_id=$5 AND item_id=$6`,
        [input.quantity, input.actorUserId, input.tenantId, input.organizationId, input.warehouseId, input.itemId],
      );
      await client.query(
        `INSERT INTO inventory_movements
          (tenant_id,organization_id,branch_id,financial_year_id,warehouse_id,item_id,movement_type,quantity,source_type,source_id,operation_key,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,'RECEIPT',$7,$8,$9,$10,$11)`,
        [input.tenantId, input.organizationId, input.branchId, input.financialYearId, input.warehouseId, input.itemId,
          input.quantity, input.sourceType, input.sourceId, input.operationKey, input.actorUserId],
      );
      return this.stockFor(client, input);
    });
  }

  async reserveStock(input: {
    tenantId: string; organizationId: string; branchId: string; financialYearId: string; warehouseId: string;
    itemId: string; quantity: number; sourceType: string; sourceId: string; idempotencyKey: string; actorUserId: string;
  }) {
    return this.withTenant(input.tenantId, input.organizationId, input.actorUserId, async (client) => {
      const prior = await client.query(
        `SELECT ${reservationColumns} FROM inventory_reservations
         WHERE tenant_id=$1 AND organization_id=$2 AND source_type=$3 AND source_id=$4 AND item_id=$5`,
        [input.tenantId, input.organizationId, input.sourceType, input.sourceId, input.itemId],
      );
      if (prior.rows[0]) {
        if (Number(prior.rows[0].quantity) !== input.quantity) throw new ValidationError('Reservation source already exists with a different quantity.');
        return this.mapReservation(prior.rows[0]);
      }
      await this.assertWarehouseAndItem(client, input);
      await this.ensureStock(client, input);
      const stock = await client.query(
        `SELECT ${stockColumns} FROM inventory_stock
         WHERE tenant_id=$1 AND organization_id=$2 AND warehouse_id=$3 AND item_id=$4 FOR UPDATE`,
        [input.tenantId, input.organizationId, input.warehouseId, input.itemId],
      );
      const concurrentPrior = await client.query(
        `SELECT ${reservationColumns} FROM inventory_reservations
         WHERE tenant_id=$1 AND organization_id=$2 AND source_type=$3 AND source_id=$4 AND item_id=$5`,
        [input.tenantId, input.organizationId, input.sourceType, input.sourceId, input.itemId],
      );
      if (concurrentPrior.rows[0]) {
        if (Number(concurrentPrior.rows[0].quantity) !== input.quantity) {
          throw new ValidationError('Reservation source already exists with a different quantity.');
        }
        return this.mapReservation(concurrentPrior.rows[0]);
      }
      if (!stock.rows[0] || Number(stock.rows[0].availableQuantity) < input.quantity) {
        throw new ValidationError('Insufficient available stock for reservation.');
      }
      await client.query(
        `UPDATE inventory_stock SET reserved_quantity=reserved_quantity+$1,updated_at=now(),updated_by=$2,version=version+1
         WHERE tenant_id=$3 AND organization_id=$4 AND warehouse_id=$5 AND item_id=$6`,
        [input.quantity, input.actorUserId, input.tenantId, input.organizationId, input.warehouseId, input.itemId],
      );
      const result = await client.query(
        `INSERT INTO inventory_reservations
          (tenant_id,organization_id,branch_id,financial_year_id,warehouse_id,item_id,source_type,source_id,idempotency_key,quantity,created_by,updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
         RETURNING ${reservationColumns}`,
        [input.tenantId, input.organizationId, input.branchId, input.financialYearId, input.warehouseId, input.itemId,
          input.sourceType, input.sourceId, input.idempotencyKey, input.quantity, input.actorUserId],
      );
      return this.mapReservation(result.rows[0]);
    });
  }

  async listReservations(input: { tenantId: string; organizationId: string; page: number; pageSize: number; status?: 'RESERVED' | 'RELEASED' | 'FULFILLED' }) {
    return this.withTenant(input.tenantId, input.organizationId, undefined, async (client) => {
      const values: unknown[] = [input.tenantId, input.organizationId];
      const filters = ['tenant_id=$1', 'organization_id=$2'];
      if (input.status) { values.push(input.status); filters.push(`status=$${values.length}`); }
      const count = await client.query(`SELECT count(*)::int AS count FROM inventory_reservations WHERE ${filters.join(' AND ')}`, values);
      values.push((input.page - 1) * input.pageSize, input.pageSize);
      const rows = await client.query(
        `SELECT ${reservationColumns} FROM inventory_reservations WHERE ${filters.join(' AND ')}
         ORDER BY created_at DESC, id DESC OFFSET $${values.length - 1} LIMIT $${values.length}`,
        values,
      );
      return { items: rows.rows.map((row) => this.mapReservation(row)), total: Number(count.rows[0].count) };
    });
  }
  async listReservationsBySource(input: { tenantId: string; organizationId: string; branchId: string; financialYearId: string; sourceType: string; sourceId: string }) {
    return this.withTenant(input.tenantId, input.organizationId, undefined, async (client) => {
      const result = await client.query(
        `SELECT ${reservationColumns} FROM inventory_reservations
         WHERE tenant_id=$1 AND organization_id=$2 AND branch_id=$3 AND financial_year_id=$4
           AND source_type=$5 AND source_id=$6 ORDER BY item_id`,
        [input.tenantId, input.organizationId, input.branchId, input.financialYearId, input.sourceType, input.sourceId],
      );
      return result.rows.map((row) => this.mapReservation(row));
    });
  }
  async fulfillReservationsBySource(input: { tenantId: string; organizationId: string; branchId: string; financialYearId: string; sourceType: string; sourceId: string; operationKey: string; actorUserId: string }) {
    return this.withTenant(input.tenantId, input.organizationId, input.actorUserId, async (client) => {
      const rows = await client.query(
        `SELECT id FROM inventory_reservations
         WHERE tenant_id=$1 AND organization_id=$2 AND branch_id=$3 AND financial_year_id=$4
           AND source_type=$5 AND source_id=$6 ORDER BY item_id FOR UPDATE`,
        [input.tenantId, input.organizationId, input.branchId, input.financialYearId, input.sourceType, input.sourceId],
      );
      if (!rows.rows.length) throw new ValidationError('No Inventory reservations exist for the Sales Order.');
      const results: InventoryReservationRecord[] = [];
      for (const row of rows.rows) {
        results.push(await this.fulfillReservation({ ...input, reservationId: row.id, operationKey: `${input.operationKey}:${row.id}` }));
      }
      return results;
    });
  }

  async releaseReservation(input: {
    tenantId: string; organizationId: string; branchId: string; financialYearId: string; reservationId: string;
    operationKey: string; actorUserId: string;
  }) {
    return this.withTenant(input.tenantId, input.organizationId, input.actorUserId, async (client) => {
      const reservation = await this.lockReservation(client, input);
      if (reservation.status === 'RELEASED') return reservation;
      if (reservation.status === 'FULFILLED') throw new ValidationError('Fulfilled reservations cannot be released.');
      await client.query(
        `UPDATE inventory_stock SET reserved_quantity=reserved_quantity-$1,updated_at=now(),updated_by=$2,version=version+1
         WHERE tenant_id=$3 AND organization_id=$4 AND warehouse_id=$5 AND item_id=$6`,
        [reservation.quantity, input.actorUserId, input.tenantId, input.organizationId, reservation.warehouseId, reservation.itemId],
      );
      const result = await client.query(
        `UPDATE inventory_reservations SET status='RELEASED',updated_at=now(),updated_by=$1,version=version+1
         WHERE id=$2 AND tenant_id=$3 RETURNING ${reservationColumns}`,
        [input.actorUserId, input.reservationId, input.tenantId],
      );
      return this.mapReservation(result.rows[0]);
    });
  }

  async fulfillReservation(input: {
    tenantId: string; organizationId: string; branchId: string; financialYearId: string; reservationId: string;
    operationKey: string; actorUserId: string;
  }) {
    return this.withTenant(input.tenantId, input.organizationId, input.actorUserId, async (client) => {
      const reservation = await this.lockReservation(client, input);
      if (reservation.status === 'FULFILLED') return reservation;
      if (reservation.status === 'RELEASED') throw new ValidationError('Released reservations cannot be fulfilled.');
      const movement = await client.query(
        `SELECT id FROM inventory_movements WHERE tenant_id=$1 AND organization_id=$2 AND operation_key=$3`,
        [input.tenantId, input.organizationId, input.operationKey],
      );
      if (movement.rows[0]) return reservation;
      const stockUpdate = await client.query(
        `UPDATE inventory_stock SET on_hand_quantity=on_hand_quantity-$1,reserved_quantity=reserved_quantity-$1,
          updated_at=now(),updated_by=$2,version=version+1
         WHERE tenant_id=$3 AND organization_id=$4 AND warehouse_id=$5 AND item_id=$6
           AND on_hand_quantity >= $1 AND reserved_quantity >= $1`,
        [reservation.quantity, input.actorUserId, input.tenantId, input.organizationId, reservation.warehouseId, reservation.itemId],
      );
      if (stockUpdate.rowCount !== 1) throw new ValidationError('Insufficient reserved stock for fulfillment.');
      await client.query(
        `INSERT INTO inventory_movements
          (tenant_id,organization_id,branch_id,financial_year_id,warehouse_id,item_id,movement_type,quantity,source_type,source_id,operation_key,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,'ISSUE',$7,'RESERVATION',$8,$9,$10)`,
        [input.tenantId, input.organizationId, input.branchId, input.financialYearId, reservation.warehouseId, reservation.itemId,
          reservation.quantity, reservation.id, input.operationKey, input.actorUserId],
      );
      const result = await client.query(
        `UPDATE inventory_reservations SET status='FULFILLED',updated_at=now(),updated_by=$1,version=version+1
         WHERE id=$2 AND tenant_id=$3 RETURNING ${reservationColumns}`,
        [input.actorUserId, input.reservationId, input.tenantId],
      );
      return this.mapReservation(result.rows[0]);
    });
  }

  async returnStock(input: {
    tenantId: string; organizationId: string; branchId: string; financialYearId: string; warehouseId: string;
    itemId: string; quantity: number; sourceType: string; sourceId: string; operationKey: string; actorUserId: string;
  }) {
    return this.withTenant(input.tenantId, input.organizationId, input.actorUserId, async (client) => {
      const prior = await this.findMovement(client, input);
      if (prior) return prior;
      await this.assertWarehouseAndItem(client, input);
      await this.ensureStock(client, input);
      await client.query(
        `UPDATE inventory_stock SET on_hand_quantity=on_hand_quantity+$1,updated_at=now(),updated_by=$2,version=version+1
         WHERE tenant_id=$3 AND organization_id=$4 AND warehouse_id=$5 AND item_id=$6`,
        [input.quantity, input.actorUserId, input.tenantId, input.organizationId, input.warehouseId, input.itemId],
      );
      const result = await client.query(
        `INSERT INTO inventory_movements
          (tenant_id,organization_id,branch_id,financial_year_id,warehouse_id,item_id,movement_type,quantity,source_type,source_id,operation_key,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,'RETURN',$7,$8,$9,$10,$11) RETURNING ${movementColumns}`,
        [input.tenantId, input.organizationId, input.branchId, input.financialYearId, input.warehouseId, input.itemId,
          input.quantity, input.sourceType, input.sourceId, input.operationKey, input.actorUserId],
      );
      return this.mapMovement(result.rows[0]);
    });
  }

  private async assertWarehouseAndItem(client: PoolClient, input: { tenantId: string; organizationId: string; warehouseId: string; itemId: string }) {
    const warehouse = await client.query(
      `SELECT id FROM inventory_warehouses WHERE id=$1 AND tenant_id=$2 AND organization_id=$3 AND status='ACTIVE'`,
      [input.warehouseId, input.tenantId, input.organizationId],
    );
    if (!warehouse.rows[0]) throw new ValidationError('Active warehouse was not found in the organization.');
    const item = await client.query(
      `SELECT id FROM inventory_items WHERE id=$1 AND tenant_id=$2 AND organization_id=$3 AND status='ACTIVE' AND sales_eligible=true AND is_deleted=false`,
      [input.itemId, input.tenantId, input.organizationId],
    );
    if (!item.rows[0]) throw new ValidationError('Active sales-eligible item was not found in the organization.');
  }

  private async ensureStock(client: PoolClient, input: { tenantId: string; organizationId: string; warehouseId: string; itemId: string; actorUserId: string }) {
    await client.query(
      `INSERT INTO inventory_stock (tenant_id,organization_id,warehouse_id,item_id,created_by,updated_by)
       VALUES ($1,$2,$3,$4,$5,$5) ON CONFLICT (tenant_id,organization_id,warehouse_id,item_id) DO NOTHING`,
      [input.tenantId, input.organizationId, input.warehouseId, input.itemId, input.actorUserId],
    );
  }

  private async stockFor(client: PoolClient, input: { tenantId: string; organizationId: string; warehouseId: string; itemId: string }) {
    const result = await client.query(
      `SELECT ${stockColumns} FROM inventory_stock WHERE tenant_id=$1 AND organization_id=$2 AND warehouse_id=$3 AND item_id=$4`,
      [input.tenantId, input.organizationId, input.warehouseId, input.itemId],
    );
    return this.mapStock(result.rows[0]);
  }

  private async lockReservation(client: PoolClient, input: { tenantId: string; organizationId: string; reservationId: string }) {
    const result = await client.query(
      `SELECT ${reservationColumns} FROM inventory_reservations
       WHERE id=$1 AND tenant_id=$2 AND organization_id=$3 FOR UPDATE`,
      [input.reservationId, input.tenantId, input.organizationId],
    );
    if (!result.rows[0]) throw new ValidationError('Reservation was not found in the organization.');
    return this.mapReservation(result.rows[0]);
  }

  private async findMovement(client: PoolClient, input: { tenantId: string; organizationId: string; operationKey: string }) {
    const result = await client.query(
      `SELECT ${movementColumns} FROM inventory_movements WHERE tenant_id=$1 AND organization_id=$2 AND operation_key=$3`,
      [input.tenantId, input.organizationId, input.operationKey],
    );
    return result.rows[0] ? this.mapMovement(result.rows[0]) : null;
  }

  private async withTenant<T>(tenantId: string, organizationId: string, userId: string | undefined, callback: (client: PoolClient) => Promise<T>) {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, callback, { organizationId, userId });
  }
  private mapWarehouse(row: Record<string, unknown>): WarehouseRecord { return { ...row, createdAt: new Date(String(row.createdAt)), updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : null } as WarehouseRecord; }
  private mapStock(row: Record<string, unknown>): InventoryStockRecord { return { ...row, onHandQuantity: Number(row.onHandQuantity), reservedQuantity: Number(row.reservedQuantity), availableQuantity: Number(row.availableQuantity) } as InventoryStockRecord; }
  private mapReservation(row: Record<string, unknown>): InventoryReservationRecord { return { ...row, quantity: Number(row.quantity), createdAt: new Date(String(row.createdAt)), updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : null } as InventoryReservationRecord; }
  private mapMovement(row: Record<string, unknown>): InventoryMovementRecord { return { ...row, quantity: Number(row.quantity), createdAt: new Date(String(row.createdAt)) } as InventoryMovementRecord; }
}
