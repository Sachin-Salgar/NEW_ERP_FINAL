import type { Pool } from 'pg';
import { withTenantContext } from '../tenant-context.js';
import type {
  ProcurementContext,
  ProcurementLineInput,
  ProcurementRepository,
} from '../../../domain/contracts/procurement.js';
import { ValidationError } from '../../../domain/errors.js';

export class PostgresProcurementRepository implements ProcurementRepository {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey = 'app.current_tenant_id',
  ) {}
  private run<T>(
    c: ProcurementContext,
    fn: (client: {
      query: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
    }) => Promise<T>,
  ) {
    return withTenantContext(this.pool, this.tenantContextKey, c.tenantId, fn, {
      organizationId: c.organizationId,
      userId: c.userId,
    });
  }
  async completeReceipt(c: ProcurementContext & { id: string; expectedVersion: number }) {
    return this.run(c, async (db) => {
      const current = (
        await db.query(
          `SELECT * FROM procurement_receipts WHERE id=$1 AND tenant_id=$2 AND organization_id=$3 AND is_deleted=false FOR UPDATE`,
          [c.id, c.tenantId, c.organizationId],
        )
      ).rows[0];
      if (!current) return null;
      const lines = (
        await db.query(`SELECT item_id AS "itemId", quantity FROM procurement_receipt_lines WHERE receipt_id=$1`, [
          c.id,
        ])
      ).rows.map((row) => ({ itemId: String(row.itemId), quantity: Number(row.quantity) }));
      if (current.status === 'COMPLETED' || current.status === 'POSTED')
        return { receipt: current, lines, alreadyCompleted: true };
      if (current.status !== 'DRAFT') throw new Error(`Receipt cannot be completed from ${current.status}.`);
      const receipt = (
        await db.query(
          `UPDATE procurement_receipts SET status='COMPLETED',updated_at=now(),updated_by=$5,version=version+1
         WHERE id=$1 AND tenant_id=$2 AND organization_id=$3 AND version=$4 AND status='DRAFT' AND is_deleted=false RETURNING *`,
          [c.id, c.tenantId, c.organizationId, c.expectedVersion, c.userId],
        )
      ).rows[0];
      if (!receipt) throw new Error('Receipt was modified concurrently.');
      return { receipt, lines, alreadyCompleted: false };
    });
  }
  async cancelReceipt(c: ProcurementContext & { id: string; expectedVersion: number }) {
    return this.run(
      c,
      async (db) =>
        (
          await db.query(
            `UPDATE procurement_receipts SET status='CANCELLED',updated_at=now(),updated_by=$5,version=version+1
       WHERE id=$1 AND tenant_id=$2 AND organization_id=$3 AND version=$4 AND status='DRAFT' AND is_deleted=false RETURNING *`,
            [c.id, c.tenantId, c.organizationId, c.expectedVersion, c.userId],
          )
        ).rows[0] ?? null,
    );
  }
  async createSupplier(c: ProcurementContext & { name: string; code?: string; email?: string }) {
    return this.run(
      c,
      async (db) =>
        (
          await db.query(
            `INSERT INTO procurement_suppliers(tenant_id,organization_id,code,name,email,created_by) VALUES($1,$2,COALESCE($3,'SUP-'||substr(gen_random_uuid()::text,1,8)),$4,$5,$6) RETURNING id,tenant_id AS "tenantId",organization_id AS "organizationId",code,name,email,status,created_at AS "createdAt"`,
            [c.tenantId, c.organizationId, c.code ?? null, c.name, c.email ?? null, c.userId],
          )
        ).rows[0],
    );
  }
  async listSuppliers(c: ProcurementContext, page: number, pageSize: number) {
    return this.list(c, 'procurement_suppliers', page, pageSize, 'name');
  }
  async getSupplier(c: ProcurementContext, id: string) {
    return this.get(c, 'procurement_suppliers', id);
  }
  async updateSupplier(c: ProcurementContext & { id: string; name: string; email?: string; expectedVersion: number }) {
    return this.update(c, 'procurement_suppliers', c.id, c.expectedVersion, 'name=$5,email=$6', [
      c.name,
      c.email ?? null,
    ]);
  }
  async deleteSupplier(c: ProcurementContext & { id: string; expectedVersion: number }) {
    return this.run(
      c,
      async (db) =>
        (
          await db.query(
            `UPDATE procurement_suppliers SET is_deleted=true,deleted_at=now(),deleted_by=$5,updated_at=now(),updated_by=$5,version=version+1 WHERE id=$1 AND tenant_id=$2 AND organization_id=$3 AND version=$4 AND is_deleted=false RETURNING *`,
            [c.id, c.tenantId, c.organizationId, c.expectedVersion, c.userId],
          )
        ).rows[0] ?? null,
    );
  }
  async createRequisition(
    c: ProcurementContext & { requiredDate: string; justification?: string; lines: ProcurementLineInput[] },
  ) {
    return this.run(c, async (db) => {
      const h = (
        await db.query(
          `INSERT INTO procurement_requisitions(tenant_id,organization_id,branch_id,financial_year_id,required_date,justification,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,tenant_id AS "tenantId",organization_id AS "organizationId",branch_id AS "branchId",financial_year_id AS "financialYearId",requisition_number AS "requisitionNumber",required_date AS "requiredDate",justification,status,created_at AS "createdAt"`,
          [
            c.tenantId,
            c.organizationId,
            c.branchId,
            c.financialYearId,
            c.requiredDate,
            c.justification ?? null,
            c.userId,
          ],
        )
      ).rows[0];
      await this.insertLines(db, 'procurement_requisition_lines', 'requisition_id', h.id as string, c, c.lines);
      return h;
    });
  }
  async listRequisitions(c: ProcurementContext, page: number, pageSize: number) {
    return this.list(c, 'procurement_requisitions', page, pageSize, 'created_at');
  }
  async getRequisition(c: ProcurementContext, id: string) {
    return this.get(c, 'procurement_requisitions', id);
  }
  async updateRequisition(
    c: ProcurementContext & { id: string; requiredDate: string; justification?: string; expectedVersion: number },
  ) {
    return this.update(
      c,
      'procurement_requisitions',
      c.id,
      c.expectedVersion,
      'required_date=$5,justification=$6',
      [c.requiredDate, c.justification ?? null],
      'DRAFT',
    );
  }
  async transitionRequisition(c: ProcurementContext & { id: string; status: string; expectedVersion: number }) {
    return this.transition(c, 'procurement_requisitions', c.id, c.status, c.expectedVersion);
  }
  async createPurchaseOrder(
    c: ProcurementContext & {
      supplierId: string;
      requisitionId?: string;
      orderDate: string;
      lines: ProcurementLineInput[];
    },
  ) {
    return this.run(c, async (db) => {
      const h = (
        await db.query(
          `INSERT INTO procurement_purchase_orders(tenant_id,organization_id,branch_id,financial_year_id,supplier_id,requisition_id,order_date,created_by)
           SELECT $1,$2,$3,$4,id,$6,$7,$8 FROM procurement_suppliers
           WHERE id=$5 AND tenant_id=$1 AND organization_id=$2 AND is_deleted=false
           RETURNING id,tenant_id AS "tenantId",organization_id AS "organizationId",branch_id AS "branchId",financial_year_id AS "financialYearId",po_number AS "poNumber",supplier_id AS "supplierId",requisition_id AS "requisitionId",order_date AS "orderDate",status,created_at AS "createdAt"`,
          [
            c.tenantId,
            c.organizationId,
            c.branchId,
            c.financialYearId,
            c.supplierId,
            c.requisitionId ?? null,
            c.orderDate,
            c.userId,
          ],
        )
      ).rows[0];
      if (!h) throw new ValidationError('Supplier not found or deleted.');
      await this.insertLines(db, 'procurement_purchase_order_lines', 'purchase_order_id', h.id as string, c, c.lines);
      return h;
    });
  }
  async listPurchaseOrders(c: ProcurementContext, page: number, pageSize: number) {
    return this.list(c, 'procurement_purchase_orders', page, pageSize, 'created_at');
  }
  async getPurchaseOrder(c: ProcurementContext, id: string) {
    return this.get(c, 'procurement_purchase_orders', id);
  }
  async updatePurchaseOrder(c: ProcurementContext & { id: string; orderDate: string; expectedVersion: number }) {
    return this.update(
      c,
      'procurement_purchase_orders',
      c.id,
      c.expectedVersion,
      'order_date=$5',
      [c.orderDate],
      'DRAFT',
    );
  }
  async transitionPurchaseOrder(c: ProcurementContext & { id: string; status: string; expectedVersion: number }) {
    return this.transition(c, 'procurement_purchase_orders', c.id, c.status, c.expectedVersion);
  }
  async createReceipt(
    c: ProcurementContext & {
      purchaseOrderId: string;
      warehouseId: string;
      receiptDate: string;
      lines: Array<{ itemId: string; quantity: number }>;
      operationKey: string;
    },
  ) {
    return this.run(c, async (db) => {
      const po = (
        await db.query(
          `SELECT id FROM procurement_purchase_orders WHERE id=$1 AND tenant_id=$2 AND organization_id=$3 AND status='APPROVED' AND is_deleted=false FOR UPDATE`,
          [c.purchaseOrderId, c.tenantId, c.organizationId],
        )
      ).rows[0];
      if (!po) throw new ValidationError('An approved purchase order is required.');
      const existing = (
        await db.query(
          `SELECT id FROM procurement_receipts WHERE tenant_id=$1 AND operation_key=$2 AND is_deleted=false`,
          [c.tenantId, c.operationKey],
        )
      ).rows[0];
      if (existing) {
        const existingLines = (
          await db.query(`SELECT item_id AS "itemId", quantity FROM procurement_receipt_lines WHERE receipt_id=$1`, [
            existing.id,
          ])
        ).rows.map((row) => ({ itemId: String(row.itemId), quantity: Number(row.quantity) }));
        return { id: String(existing.id), lines: existingLines };
      }
      const requested = new Map(c.lines.map((line) => [line.itemId, line.quantity]));
      const lines = (
        await db.query(
          `SELECT pol.item_id AS "itemId", pol.quantity,
           COALESCE((SELECT SUM(prl.quantity) FROM procurement_receipt_lines prl JOIN procurement_receipts pr ON pr.id=prl.receipt_id
             WHERE pr.purchase_order_id=pol.purchase_order_id AND prl.item_id=pol.item_id AND pr.tenant_id=$1 AND pr.organization_id=$2 AND pr.status='COMPLETED'),0) AS received
         FROM procurement_purchase_order_lines pol WHERE pol.purchase_order_id=$3 AND pol.tenant_id=$1 AND pol.organization_id=$2`,
          [c.tenantId, c.organizationId, c.purchaseOrderId],
        )
      ).rows;
      for (const line of c.lines) {
        const allowed = lines.find((row) => row.itemId === line.itemId);
        if (!allowed || line.quantity > Number(allowed.quantity) - Number(allowed.received))
          throw new ValidationError(
            `Receipt quantity exceeds outstanding purchase order quantity for item ${line.itemId}.`,
          );
      }
      if (requested.size !== lines.filter((line) => requested.has(String(line.itemId))).length)
        throw new ValidationError('Receipt contains an item not on the purchase order.');
      const h = (
        await db.query(
          `INSERT INTO procurement_receipts(tenant_id,organization_id,branch_id,financial_year_id,purchase_order_id,warehouse_id,receipt_date,operation_key,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(tenant_id,operation_key) DO UPDATE SET operation_key=EXCLUDED.operation_key RETURNING id`,
          [
            c.tenantId,
            c.organizationId,
            c.branchId,
            c.financialYearId,
            c.purchaseOrderId,
            c.warehouseId,
            c.receiptDate,
            c.operationKey,
            c.userId,
          ],
        )
      ).rows[0];
      for (const line of c.lines)
        await db.query(
          `INSERT INTO procurement_receipt_lines(tenant_id,organization_id,receipt_id,item_id,quantity) VALUES($1,$2,$3,$4,$5) ON CONFLICT(receipt_id,item_id) DO UPDATE SET quantity=EXCLUDED.quantity`,
          [c.tenantId, c.organizationId, h.id, line.itemId, line.quantity],
        );
      return { id: String(h.id), lines: c.lines };
    });
  }
  async updateReceipt(
    c: ProcurementContext & {
      id: string;
      warehouseId: string;
      receiptDate: string;
      lines: Array<{ itemId: string; quantity: number }>;
      expectedVersion: number;
    },
  ) {
    return this.run(c, async (db) => {
      const current = (
        await db.query(
          `SELECT * FROM procurement_receipts WHERE id=$1 AND tenant_id=$2 AND organization_id=$3 AND is_deleted=false FOR UPDATE`,
          [c.id, c.tenantId, c.organizationId],
        )
      ).rows[0];
      if (!current) return null;
      if (current.status !== 'DRAFT') throw new ValidationError('Only draft receipts can be updated.');
      if (Number(current.version) !== c.expectedVersion)
        throw new ValidationError('Receipt was modified concurrently.');
      await db.query(
        `SELECT id FROM procurement_purchase_orders
         WHERE id=$1 AND tenant_id=$2 AND organization_id=$3 AND status='APPROVED' AND is_deleted=false
         FOR UPDATE`,
        [current.purchase_order_id, c.tenantId, c.organizationId],
      );
      const purchaseOrderLines = (
        await db.query(
          `SELECT pol.item_id AS "itemId", pol.quantity,
             COALESCE((SELECT SUM(prl.quantity) FROM procurement_receipt_lines prl
               JOIN procurement_receipts pr ON pr.id=prl.receipt_id
              WHERE pr.purchase_order_id=pol.purchase_order_id AND prl.item_id=pol.item_id
                AND pr.tenant_id=$1 AND pr.organization_id=$2 AND pr.status='COMPLETED'
                AND pr.id <> $3),0) AS received
             FROM procurement_purchase_order_lines pol
            WHERE pol.purchase_order_id=$4 AND pol.tenant_id=$1 AND pol.organization_id=$2`,
          [c.tenantId, c.organizationId, c.id, current.purchase_order_id],
        )
      ).rows;
      for (const line of c.lines) {
        const allowed = purchaseOrderLines.find((row) => row.itemId === line.itemId);
        if (!allowed || line.quantity > Number(allowed.quantity) - Number(allowed.received))
          throw new ValidationError(
            `Receipt quantity exceeds outstanding purchase order quantity for item ${line.itemId}.`,
          );
      }
      if (new Set(c.lines.map((line) => line.itemId)).size !== c.lines.length)
        throw new ValidationError('Receipt contains duplicate items.');
      if (
        c.lines.length !==
        purchaseOrderLines.filter((line) => c.lines.some((item) => item.itemId === line.itemId)).length
      )
        throw new ValidationError('Receipt contains an item not on the purchase order.');
      const updated = (
        await db.query(
          `UPDATE procurement_receipts SET warehouse_id=$5,receipt_date=$6,updated_at=now(),updated_by=$7,version=version+1
           WHERE id=$1 AND tenant_id=$2 AND organization_id=$3 AND version=$4 AND is_deleted=false RETURNING *`,
          [c.id, c.tenantId, c.organizationId, c.expectedVersion, c.warehouseId, c.receiptDate, c.userId],
        )
      ).rows[0];
      await db.query(`DELETE FROM procurement_receipt_lines WHERE receipt_id=$1`, [c.id]);
      for (const line of c.lines)
        await db.query(
          `INSERT INTO procurement_receipt_lines(tenant_id,organization_id,receipt_id,item_id,quantity) VALUES($1,$2,$3,$4,$5)`,
          [c.tenantId, c.organizationId, c.id, line.itemId, line.quantity],
        );
      return updated ?? null;
    });
  }
  async getReceipt(c: ProcurementContext, id: string) {
    return this.get(c, 'procurement_receipts', id);
  }
  async listReceipts(c: ProcurementContext, page: number, pageSize: number) {
    return this.list(c, 'procurement_receipts', page, pageSize, 'created_at');
  }
  async transitionReceipt(c: ProcurementContext & { id: string; status: string; expectedVersion: number }) {
    return this.transition(c, 'procurement_receipts', c.id, c.status, c.expectedVersion);
  }
  private async insertLines(
    db: { query: (sql: string, values?: unknown[]) => Promise<unknown> },
    table: string,
    fk: string,
    id: string,
    c: ProcurementContext,
    lines: ProcurementLineInput[],
  ) {
    for (const [index, line] of lines.entries())
      await db.query(
        `INSERT INTO ${table}(tenant_id,organization_id,${fk},line_number,item_id,description,quantity,unit_price,unit_of_measure) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          c.tenantId,
          c.organizationId,
          id,
          index + 1,
          line.itemId,
          line.description,
          line.quantity,
          line.unitPrice ?? 0,
          line.unitOfMeasure,
        ],
      );
  }
  private async list(c: ProcurementContext, table: string, page: number, pageSize: number, order: string) {
    return this.run(c, async (db) => {
      const values = [c.tenantId, c.organizationId, pageSize, (page - 1) * pageSize];
      const count = await db.query(
        `SELECT count(*)::int AS count FROM ${table} WHERE tenant_id=$1 AND organization_id=$2 AND is_deleted=false`,
        values.slice(0, 2),
      );
      const rows = await db.query(
        `SELECT * FROM ${table} WHERE tenant_id=$1 AND organization_id=$2 AND is_deleted=false ORDER BY ${order} DESC OFFSET $4 LIMIT $3`,
        values,
      );
      return { items: rows.rows, total: Number(count.rows[0].count) };
    });
  }
  private async get(c: ProcurementContext, table: string, id: string) {
    return this.run(
      c,
      async (db) =>
        (
          await db.query(
            `SELECT * FROM ${table} WHERE id=$1 AND tenant_id=$2 AND organization_id=$3 AND is_deleted=false`,
            [id, c.tenantId, c.organizationId],
          )
        ).rows[0] ?? null,
    );
  }
  private async update(
    c: ProcurementContext & { id: string; expectedVersion: number },
    table: string,
    id: string,
    version: number,
    set: string,
    values: unknown[],
    status?: string,
  ) {
    return this.run(
      c,
      async (db) =>
        (
          await db.query(
            `UPDATE ${table} SET ${set},updated_at=now(),updated_by=$${5 + values.length},version=version+1 WHERE id=$1 AND tenant_id=$2 AND organization_id=$3 AND version=$4 AND is_deleted=false${status ? ` AND status='${status}'` : ''} RETURNING *`,
            [id, c.tenantId, c.organizationId, version, ...values, c.userId],
          )
        ).rows[0] ?? null,
    );
  }
  private async transition(
    c: ProcurementContext & { id: string; status: string; expectedVersion: number },
    table: string,
    id: string,
    status: string,
    version: number,
  ) {
    return this.run(
      c,
      async (db) =>
        (
          await db.query(
            `UPDATE ${table} SET status=$5,updated_at=now(),updated_by=$6,version=version+1 WHERE id=$1 AND tenant_id=$2 AND organization_id=$3 AND version=$4 AND is_deleted=false RETURNING *`,
            [id, c.tenantId, c.organizationId, version, status, c.userId],
          )
        ).rows[0] ?? null,
    );
  }
}
