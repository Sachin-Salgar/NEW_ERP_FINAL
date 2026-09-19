// @ts-nocheck
import type { Pool } from 'pg';
import type { MachineRepository } from '../../../domain/contracts/manufacturing-machine.js';
import { withTenantContext } from '../tenant-context.js';

const columns = 'id, tenant_id AS "tenantId", branch_id AS "branchId", code, name, serial_number AS "serialNumber", model, manufacturer, manufacture_year AS "manufactureYear", section, division, operational_group AS "operationalGroup", capacity, capacity_uom AS "capacityUom", power, power_uom AS "powerUom", cut_time_applicable AS "cutTimeApplicable", production_machine AS "productionMachine", fixed_asset_id AS "fixedAssetId", status, is_deleted AS "isDeleted", version, created_at AS "createdAt", created_by AS "createdBy", updated_at AS "updatedAt", updated_by AS "updatedBy"';

export class PostgresManufacturingMachineRepository implements MachineRepository {
  constructor(private readonly pool: Pool, private readonly tenantContextKey = 'app.current_tenant_id') {}

  async create(input: any) {
    return withTenantContext(this.pool, this.tenantContextKey, input.tenantId, async client => {
      const r = await client.query('INSERT INTO manufacturing_machines (tenant_id,branch_id,code,name,serial_number,model,manufacturer,manufacture_year,section,division,operational_group,capacity,capacity_uom,power,power_uom,cut_time_applicable,production_machine,fixed_asset_id,status,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$20) RETURNING ' + columns,
        [input.tenantId,input.branchId,input.code,input.name,input.serialNumber ?? null,input.model ?? null,input.manufacturer ?? null,input.manufactureYear ?? null,input.section ?? null,input.division ?? null,input.operationalGroup ?? null,input.capacity ?? null,input.capacityUom ?? null,input.power ?? null,input.powerUom ?? null,input.cutTimeApplicable ?? true,input.productionMachine ?? false,input.fixedAssetId ?? null,input.status ?? 'ACTIVE',input.actorUserId]);
      return r.rows[0];
    });
  }

  async getById(tenantId: string, id: string, branchId?: string) {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async client => {
      const values: unknown[] = [tenantId, id]; let where = 'tenant_id=$1 AND id=$2 AND is_deleted=false';
      if (branchId) { values.push(branchId); where += ' AND branch_id=$' + values.length; }
      const r = await client.query('SELECT ' + columns + ' FROM manufacturing_machines WHERE ' + where, values);
      return r.rows[0] ?? null;
    });
  }

  async list(tenantId: string, query: any) {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async client => {
      const values: unknown[] = [tenantId]; const filters = ['tenant_id=$1', 'is_deleted=false'];
      if (query.branchId) { values.push(query.branchId); filters.push('branch_id=$' + values.length); }
      if (query.status) { values.push(query.status); filters.push('status=$' + values.length); }
      if (query.search) { values.push('%' + query.search + '%'); filters.push('(code ILIKE $' + values.length + ' OR name ILIKE $' + values.length + ' OR COALESCE(serial_number, \'\') ILIKE $' + values.length + ')'); }
      const count = await client.query('SELECT count(*)::int count FROM manufacturing_machines WHERE ' + filters.join(' AND '), values);
      values.push((query.page - 1) * query.pageSize, query.pageSize);
      const rows = await client.query('SELECT ' + columns + ' FROM manufacturing_machines WHERE ' + filters.join(' AND ') + ' ORDER BY code,id OFFSET $' + (values.length - 1) + ' LIMIT $' + values.length, values);
      return { items: rows.rows, total: Number(count.rows[0].count) };
    });
  }

  async update(input: any) {
    return withTenantContext(this.pool, this.tenantContextKey, input.tenantId, async client => {
      const r = await client.query('UPDATE manufacturing_machines SET name=$1,serial_number=$2,model=$3,manufacturer=$4,manufacture_year=$5,section=$6,division=$7,operational_group=$8,capacity=$9,capacity_uom=$10,power=$11,power_uom=$12,cut_time_applicable=$13,production_machine=$14,fixed_asset_id=$15,status=$16,updated_at=now(),updated_by=$17,version=version+1 WHERE tenant_id=$18 AND branch_id=$19 AND id=$20 AND is_deleted=false AND version=$21 RETURNING ' + columns,
        [input.name,input.serialNumber ?? null,input.model ?? null,input.manufacturer ?? null,input.manufactureYear ?? null,input.section ?? null,input.division ?? null,input.operationalGroup ?? null,input.capacity ?? null,input.capacityUom ?? null,input.power ?? null,input.powerUom ?? null,input.cutTimeApplicable,input.productionMachine,input.fixedAssetId ?? null,input.status,input.actorUserId,input.tenantId,input.branchId,input.machineId,input.expectedVersion]);
      return r.rows[0] ?? null;
    });
  }

  async softDelete(input: any) {
    return withTenantContext(this.pool, this.tenantContextKey, input.tenantId, async client => {
      const r = await client.query('UPDATE manufacturing_machines SET is_deleted=true,deleted_at=now(),deleted_by=$1,updated_at=now(),updated_by=$1,version=version+1 WHERE tenant_id=$2 AND branch_id=$3 AND id=$4 AND is_deleted=false AND version=$5 RETURNING ' + columns,
        [input.actorUserId,input.tenantId,input.branchId,input.machineId,input.expectedVersion]);
      return r.rows[0] ?? null;
    });
  }
}
