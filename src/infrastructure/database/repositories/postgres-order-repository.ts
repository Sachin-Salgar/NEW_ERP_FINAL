import type { Pool } from 'pg';
import type { OrderRepository, OrderRecord } from '../../../domain/contracts/repositories.js';
import { withTenantContext } from '../tenant-context.js';
import { ValidationError } from '../../../domain/errors.js';
const C = `id,tenant_id AS "tenantId",organization_id AS "organizationId",branch_id AS "branchId",financial_year_id AS "financialYearId",order_number AS "orderNumber",customer_id AS "customerId",quotation_id AS "quotationId",warehouse_id AS "warehouseId",reservation_status AS "reservationStatus",status,notes,subtotal::float8 AS subtotal,discount_total::float8 AS "discountTotal",total::float8 AS total,created_at AS "createdAt",created_by AS "createdBy",updated_at AS "updatedAt",updated_by AS "updatedBy",deleted_at AS "deletedAt",deleted_by AS "deletedBy",is_deleted AS "isDeleted",version_number AS "versionNumber"`;
export class PostgresOrderRepository implements OrderRepository {
  constructor(
    private readonly pool: Pool,
    private readonly key = 'app.current_tenant_id',
  ) {}
  async create(i: any) {
    return withTenantContext(
      this.pool,
      this.key,
      i.tenantId,
      async (c) => {
        const q = await c.query(
          `SELECT id,customer_id AS "customerId",branch_id AS "branchId",financial_year_id AS "financialYearId",subtotal,discount_total AS "discountTotal",total FROM sales_quotations WHERE id=$1 AND tenant_id=$2 AND organization_id=$3 AND branch_id=$4 AND financial_year_id=$5 AND status='ACCEPTED' AND is_deleted=false`,
          [i.quotationId, i.tenantId, i.organizationId, i.branchId, i.financialYearId],
        );
        if (!q.rows[0])
          throw new ValidationError('Only an accepted quotation in the active context can create an order.');
        const warehouse = await c.query(
          `SELECT id FROM inventory_warehouses WHERE id=$1 AND tenant_id=$2 AND organization_id=$3 AND status='ACTIVE'`,
          [i.warehouseId, i.tenantId, i.organizationId],
        );
        if (!warehouse.rows[0]) throw new ValidationError('An active warehouse in the organization is required.');
        const sourceItems = await c.query(
          `SELECT item_id AS "itemId" FROM sales_quotation_items
           WHERE quotation_id=$1 AND tenant_id=$2 AND organization_id=$3 AND branch_id=$4 AND financial_year_id=$5
           ORDER BY line_number`,
          [i.quotationId, i.tenantId, i.organizationId, i.branchId, i.financialYearId],
        );
        if (!sourceItems.rows.length || sourceItems.rows.some((line: any) => !line.itemId))
          throw new ValidationError('Every new Sales Order line requires an Item Master item.');
        const n = await c.query(
          `INSERT INTO code_counters(tenant_id,entity_type,scope_key,last_value) VALUES($1,'sales_order',$2,1) ON CONFLICT(tenant_id,entity_type,scope_key) DO UPDATE SET last_value=code_counters.last_value+1 RETURNING last_value`,
          [i.tenantId, i.organizationId],
        );
        const r = await c.query(
          `INSERT INTO sales_orders(tenant_id,organization_id,branch_id,financial_year_id,order_number,customer_id,quotation_id,warehouse_id,subtotal,discount_total,total,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING ${C}`,
          [
            i.tenantId,
            i.organizationId,
            i.branchId,
            i.financialYearId,
            `SO-${String(n.rows[0].last_value).padStart(6, '0')}`,
            q.rows[0].customerId,
            i.quotationId,
            i.warehouseId,
            q.rows[0].subtotal ?? 0,
            q.rows[0].discountTotal ?? 0,
            q.rows[0].total ?? 0,
            i.actorUserId,
          ],
        );
        await c.query(
          `INSERT INTO sales_order_items(tenant_id,organization_id,branch_id,financial_year_id,order_id,item_id,item_code,line_number,description,quantity,unit_price,unit_of_measure,discount_percentage,discount_amount,line_total,price_list_id,discount_rule_id,created_by,updated_by) SELECT tenant_id,organization_id,branch_id,financial_year_id,$1,item_id,item_code,line_number,description,quantity,unit_price,unit_of_measure,discount_percentage,discount_amount,line_total,price_list_id,discount_rule_id,$2,$2 FROM sales_quotation_items WHERE quotation_id=$3 AND tenant_id=$4 AND organization_id=$5 AND branch_id=$6 AND financial_year_id=$7`,
          [r.rows[0].id, i.actorUserId, i.quotationId, i.tenantId, i.organizationId, i.branchId, i.financialYearId],
        );
        return this.map(c, r.rows[0]);
      },
      { organizationId: i.organizationId, userId: i.actorUserId },
    ) as Promise<OrderRecord>;
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
        const v = [t, q.organizationId, q.branchId, q.financialYearId] as any[],
          f = ['tenant_id=$1', 'organization_id=$2', 'branch_id=$3', 'financial_year_id=$4', 'is_deleted=false'];
        if (q.search) {
          v.push(`%${q.search}%`);
          f.push(`(order_number ILIKE $${v.length} OR status::text ILIKE $${v.length})`);
        }
        const count = await c.query(`SELECT count(*)::int count FROM sales_orders WHERE ${f.join(' AND ')}`, v);
        v.push((q.page - 1) * q.pageSize, q.pageSize);
        const d = q.order === 'desc' ? 'DESC' : 'ASC';
        const rows = await c.query(
          `SELECT ${C} FROM sales_orders WHERE ${f.join(' AND ')} ORDER BY order_number ${d},id ${d} OFFSET $${v.length - 1} LIMIT $${v.length}`,
          v,
        );
        return {
          items: await Promise.all(rows.rows.map((x: any) => this.map(c, x))),
          total: Number(count.rows[0].count),
        };
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
        const r = await c.query(
          `UPDATE sales_orders SET notes=$1,updated_at=now(),updated_by=$2,version_number=version_number+1 WHERE tenant_id=$3 AND organization_id=$4 AND branch_id=$5 AND financial_year_id=$6 AND id=$7 AND status='DRAFT' AND is_deleted=false AND version_number=$8 RETURNING ${C}`,
          [
            i.notes,
            i.actorUserId,
            i.tenantId,
            i.organizationId,
            i.branchId,
            i.financialYearId,
            i.orderId,
            i.expectedVersion,
          ],
        );
        return r.rows[0] ? this.map(c, r.rows[0]) : null;
      },
      { organizationId: i.organizationId, userId: i.actorUserId },
    );
  }
  async transition(i: any) {
    return this.mutate(
      i,
      `UPDATE sales_orders SET status=$1,updated_at=now(),updated_by=$2,version_number=version_number+1 WHERE tenant_id=$3 AND organization_id=$4 AND branch_id=$5 AND financial_year_id=$6 AND id=$7 AND is_deleted=false AND version_number=$8 RETURNING ${C}`,
      [
        i.status,
        i.actorUserId,
        i.tenantId,
        i.organizationId,
        i.branchId,
        i.financialYearId,
        i.orderId,
        i.expectedVersion,
      ],
    );
  }
  async updateReservationStatus(i: any) {
    return this.mutate(
      i,
      `UPDATE sales_orders SET reservation_status=$1,updated_at=now(),updated_by=$2,version_number=version_number+1
       WHERE tenant_id=$3 AND organization_id=$4 AND branch_id=$5 AND financial_year_id=$6 AND id=$7 AND is_deleted=false
       RETURNING ${C}`,
      [i.reservationStatus, i.actorUserId, i.tenantId, i.organizationId, i.branchId, i.financialYearId, i.orderId],
    );
  }
  async softDelete(i: any) {
    return this.mutate(
      i,
      `UPDATE sales_orders SET is_deleted=true,deleted_at=now(),deleted_by=$1,updated_at=now(),updated_by=$1,version_number=version_number+1 WHERE tenant_id=$2 AND organization_id=$3 AND branch_id=$4 AND financial_year_id=$5 AND id=$6 AND status='DRAFT' AND is_deleted=false RETURNING ${C}`,
      [i.actorUserId, i.tenantId, i.organizationId, i.branchId, i.financialYearId, i.orderId],
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
      `SELECT ${C} FROM sales_orders WHERE tenant_id=$1 AND organization_id=$2 AND branch_id=$3 AND financial_year_id=$4 AND id=$5 AND is_deleted=false`,
      [t, o, b, fy, id],
    );
    return r.rows[0] ? this.map(c, r.rows[0]) : null;
  }
  private async map(c: any, r: any): Promise<OrderRecord> {
    const x = await c.query(
      `SELECT id,item_id AS "itemId",item_code AS "itemCode",line_number AS "lineNumber",description,quantity,unit_price AS "unitPrice",unit_of_measure AS "unitOfMeasure",discount_percentage AS "discountPercentage",discount_amount AS "discountAmount",line_total AS "lineTotal",price_list_id AS "priceListId",discount_rule_id AS "discountRuleId" FROM sales_order_items WHERE order_id=$1 AND tenant_id=$2 ORDER BY line_number`,
      [r.id, r.tenantId],
    );
    return {
      ...r,
      subtotal: Number(r.subtotal ?? 0),
      discountTotal: Number(r.discountTotal ?? 0),
      total: Number(r.total ?? 0),
      items: x.rows.map((a: any) => ({
        ...a,
        quantity: Number(a.quantity),
        unitPrice: Number(a.unitPrice),
        discountPercentage: Number(a.discountPercentage ?? 0),
        discountAmount: Number(a.discountAmount ?? 0),
        lineTotal: Number(a.lineTotal ?? Number(a.quantity) * Number(a.unitPrice)),
      })),
      createdAt: new Date(r.createdAt),
      updatedAt: r.updatedAt ? new Date(r.updatedAt) : null,
      deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
    };
  }
}
