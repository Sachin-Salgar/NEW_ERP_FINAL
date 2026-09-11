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
  id, tenant_id AS "tenantId", code, name, short_name AS "shortName",
  customer_type AS "customerType", customer_category AS "customerCategory",
  zone, domestic_export AS "domesticExport", in_use AS "inUse",
  merchant_exporter AS "merchantExporter", insurance, nda,
  start_date AS "startDate", expiry_date AS "expiryDate",
  address, address_1 AS "address1", city, pincode, country, state, district,
  pan_no AS "panNo", gst_no AS "gstNo", vat_no AS "vatNo", cst_no AS "cstNo",
  service_tax_no AS "serviceTaxNo", ecc_code AS "eccCode", fax, phone, mobile,
  email, contact_person AS "contactPerson", designation, website,
  interest_percent AS "interestPercent", outstanding_limit AS "outstandingLimit",
  aging_limit AS "agingLimit", cash_discount_percent AS "cashDiscountPercent",
  supplier_code AS "supplierCode", industry_type AS "industryType",
  discount_applicable AS "discountApplicable", bank_name AS "bankName",
  bank_address AS "bankAddress", bank_address_1 AS "bankAddress1",
  bank_account_no AS "bankAccountNo", range, commissionerate, division,
  reference_customer AS "referenceCustomer", document_through AS "documentThrough",
  dealer_name AS "dealerName", dealer_address AS "dealerAddress",
  dealer_address_1 AS "dealerAddress1", weekly_off AS "weeklyOff",
  group_customer AS "groupCustomer", distance_in_km AS "distanceInKm",
  marketing_by AS "marketingBy", salesman_name AS "salesmanName",
  created_at AS "createdAt", created_by AS "createdBy", updated_at AS "updatedAt",
  updated_by AS "updatedBy", deleted_at AS "deletedAt", deleted_by AS "deletedBy",
  is_deleted AS "isDeleted", version
`;

export class PostgresCustomerRepository implements CustomerRepository {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey = 'app.current_tenant_id',
  ) {}

  async create(input: { tenantId: string; name: string; actorUserId: string; [key: string]: unknown }): Promise<CustomerRecord> {
    return withTenantContext(this.pool, this.tenantContextKey, input.tenantId, async (client) => {
      const persisted = await this.insertCustomer(client, input);
      return this.loadFullCustomer(client, persisted.id);
    }, { userId: input.actorUserId });
  }

  async getById(tenantId: string, customerIdOrScope: string, maybeCustomerId?: string): Promise<CustomerRecord | null> {
    const customerId = maybeCustomerId ?? customerIdOrScope;
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      return this.loadFullCustomer(client, customerId, tenantId);
    });
  }

  async list(tenantId: string, query: CustomerListQuery): Promise<CustomerListResult> {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const values: unknown[] = [tenantId];
      const filters = ['tenant_id = $1', 'is_deleted = false'];
      if (query.search) {
       values.push(`%${query.search}%`);
       filters.push(`(name ILIKE $${values.length} OR code ILIKE $${values.length})`);
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
      const items = await Promise.all(rows.rows.map((row) => this.loadFullCustomer(client, row.id, tenantId)));
      return { items: items.filter(Boolean) as CustomerRecord[], total: Number(count.rows[0]?.count ?? 0) };
    });
  }

  async update(input: { tenantId: string; customerId: string; name: string; actorUserId: string; [key: string]: unknown }) {
    return this.mutateReturning(input.tenantId, input.actorUserId, input.customerId, input, 'update');
  }

  async softDelete(input: { tenantId: string; customerId: string; actorUserId: string; expectedVersion?: number; [key: string]: unknown }) {
    return this.mutateReturning(input.tenantId, input.actorUserId, input.customerId, input, 'delete');
  }

  private async mutateReturning(tenantId: string, actorUserId: string, customerId: string, input: Record<string, unknown>, mode: 'update' | 'delete') {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      if (mode === 'update') {
       const updateQuery = this.buildCustomerUpdateSql(input);
       let customer: CustomerRecord | null;
       if (updateQuery === null) {
         const hasChildUpdate = ['contacts', 'officeDetails', 'taxPaymentTerms', 'otherDetails'].some((key) => key in input);
         if (hasChildUpdate) {
           const values = [actorUserId, tenantId, customerId];
           let query = `UPDATE customers
             SET updated_at = NOW(), updated_by = $1, version = version + 1
             WHERE tenant_id = $2 AND id = $3 AND is_deleted = false`;
           if (input.expectedVersion !== undefined) {
             query += ' AND version = $4';
             values.push(Number(input.expectedVersion));
           }
           query += ` RETURNING ${CUSTOMER_COLUMNS}`;
           const result = await client.query(query, values);
           if (!result.rows[0]) return null;
           customer = this.mapRow(result.rows[0]);
         } else {
           customer = await this.loadFullCustomer(client, customerId, tenantId);
           if (!customer || (input.expectedVersion !== undefined && customer.version !== Number(input.expectedVersion))) return null;
         }
       } else {
         const values = updateQuery.values;
         const result = await client.query(
           `UPDATE customers SET ${updateQuery.sql}, updated_at = NOW(), updated_by = $${values.length + 1}, version = version + 1
             WHERE tenant_id = $${values.length + 2} AND id = $${values.length + 3} AND is_deleted = false ${this.versionCondition(input, values.length + 4)}
             RETURNING ${CUSTOMER_COLUMNS}`,
           [...values, actorUserId, tenantId, customerId, ...(input.expectedVersion !== undefined ? [Number(input.expectedVersion)] : [])],
         );
         if (!result.rows[0]) return null;
         customer = this.mapRow(result.rows[0]);
       }
       if (!customer) return null;
       await this.upsertChildData(client, customerId, input);
       return { ...customer, ...(await this.loadDetailRecords(client, customerId)) };
      }

      const expectedVersion = input.expectedVersion !== undefined ? Number(input.expectedVersion) : undefined;
      const values = [actorUserId, tenantId, customerId];
      const clauses = [
       'is_deleted = true',
       'deleted_at = NOW()',
       'deleted_by = $1',
       'updated_at = NOW()',
       'updated_by = $1',
       'version = version + 1',
      ];
      let query = `UPDATE customers SET ${clauses.join(', ')} WHERE tenant_id = $2 AND id = $3 AND is_deleted = false`;
      if (expectedVersion !== undefined) {
       query += ' AND version = $4';
       values.push(expectedVersion);
      }
      query += ` RETURNING ${CUSTOMER_COLUMNS}`;
      const result = await client.query(query, values);
      if (!result.rows[0]) return null;
      const customer = this.mapRow(result.rows[0]);
      return { ...customer, ...(await this.loadDetailRecords(client, customerId)) };
    }, { userId: actorUserId });
  }

  private async insertCustomer(client: any, input: Record<string, unknown>) {
    const columns: string[] = ['tenant_id', 'name', 'created_by'];
    const values: unknown[] = [input.tenantId, input.name, input.actorUserId];
    const handled = new Set(['tenantId','name','actorUserId','contacts','officeDetails','expectedVersion']);
    for (const field of this.customerFieldOrder()) {
      if (handled.has(field) || !(field in input)) continue;
      const value = input[field];
      if (value === undefined || value === null) continue;
      columns.push(this.dbColumnFor(field));
      values.push(this.normalizeDbValue(field, value));
    }
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const result = await client.query(
      `INSERT INTO customers (${columns.join(', ')}) VALUES (${placeholders}) RETURNING ${CUSTOMER_COLUMNS}`,
      values,
    );
    const customer = this.mapRow(result.rows[0]);
    await this.upsertChildData(client, customer.id, input);
    return customer;
  }

  private buildCustomerUpdateSql(input: Record<string, unknown>) {
    const assignments: string[] = [];
    const values: unknown[] = [];
    const handled = new Set(['tenantId','customerId','actorUserId','contacts','officeDetails','expectedVersion']);
    for (const field of this.customerFieldOrder()) {
      if (handled.has(field) || !(field in input)) continue;
      const value = input[field];
      if (value === undefined || value === null) continue;
      assignments.push(`${this.dbColumnFor(field)} = $${values.length + 1}`);
      values.push(this.normalizeDbValue(field, value));
    }
    if (!assignments.length) return null;
    return { sql: assignments.join(', '), values };
  }

  private async upsertChildData(client: any, customerId: string, input: Record<string, unknown>) {
    if ('contacts' in input) {
      const contacts = Array.isArray(input.contacts) ? input.contacts : [];
      await client.query('DELETE FROM customer_contacts WHERE customer_id = $1', [customerId]);
      for (const [index, contact] of contacts.entries()) {
       const item = contact && typeof contact === 'object' ? contact as Record<string, unknown> : {};
       const contactPerson = this.toNullableString(item.contactPerson ?? item.name);
       const designation = this.toNullableString(item.designation);
       const mobile = this.toNullableString(item.mobile);
       const email = this.toNullableString(item.email);
       if (!contactPerson && !designation && !mobile && !email) continue;
       await client.query(
         `INSERT INTO customer_contacts (customer_id, tenant_id, contact_person, designation, mobile, email, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
         [customerId, input.tenantId, contactPerson, designation, mobile, email, index + 1],
       );
      }
    }
    if ('officeDetails' in input) {
      const office = input.officeDetails && typeof input.officeDetails === 'object' ? input.officeDetails as Record<string, unknown> : null;
      if (office) {
       await client.query(
         `INSERT INTO customer_offices (
            customer_id, tenant_id, name, address, address_1, city, pincode, state, fax_no, phone,
            email, mobile, contact, designation, website, weekly_off, pan_no, gst_no
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (customer_id) DO UPDATE SET
            name = EXCLUDED.name, address = EXCLUDED.address, address_1 = EXCLUDED.address_1,
            city = EXCLUDED.city, pincode = EXCLUDED.pincode, state = EXCLUDED.state,
            fax_no = EXCLUDED.fax_no, phone = EXCLUDED.phone, email = EXCLUDED.email,
            mobile = EXCLUDED.mobile, contact = EXCLUDED.contact,
            designation = EXCLUDED.designation, website = EXCLUDED.website,
            weekly_off = EXCLUDED.weekly_off, pan_no = EXCLUDED.pan_no, gst_no = EXCLUDED.gst_no,
            updated_at = NOW()`,
         [
           customerId,
           input.tenantId,
           this.toNullableString(office.name),
           this.toNullableString(office.address),
           this.toNullableString(office.address1),
           this.toNullableString(office.city),
           this.toNullableString(office.pincode),
           this.toNullableString(office.state),
           this.toNullableString(office.faxNo),
           this.toNullableString(office.phone),
           this.toNullableString(office.email),
           this.toNullableString(office.mobile),
           this.toNullableString(office.contact),
           this.toNullableString(office.designation),
           this.toNullableString(office.website),
           this.toNullableString(office.weeklyOff),
           this.toNullableString(office.panNo),
           this.toNullableString(office.gstNo),
         ],
       );
      } else {
       await client.query('DELETE FROM customer_offices WHERE customer_id = $1', [customerId]);
      }
    }
    for (const [key, table, fields] of [
      ['taxPaymentTerms', 'customer_tax_payment_terms', ['taxCategory', 'paymentTerms', 'creditDays', 'taxRegistrationType']],
      ['otherDetails', 'customer_other_details', ['notes', 'reference', 'remarks']],
    ] as const) {
      if (!(key in input)) continue;
      const detail = input[key] && typeof input[key] === 'object' ? input[key] as Record<string, unknown> : null;
      if (!detail || Object.values(detail).every((value) => value === undefined || value === null || value === '')) {
        await client.query(`DELETE FROM ${table} WHERE customer_id = $1`, [customerId]);
        continue;
      }
      const columns = fields.map((field) => this.dbColumnFor(field));
      const values = fields.map((field) => detail[field] === undefined || detail[field] === '' ? null : detail[field]);
      await client.query(
        `INSERT INTO ${table} (customer_id, tenant_id, ${columns.join(', ')}) VALUES ($1, $2, ${values.map((_, valueIndex) => `$${valueIndex + 3}`).join(', ')})
         ON CONFLICT (customer_id) DO UPDATE SET ${columns.map((column) => `${column} = EXCLUDED.${column}`).join(', ')}, updated_at = NOW()`,
        [customerId, input.tenantId, ...values],
      );
    }
  }

  private async loadFullCustomer(client: any, customerId: string, tenantId?: string) {
    const result = await client.query(
      `SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = $1 ${tenantId ? 'AND tenant_id = $2' : ''} AND is_deleted = false`,
      tenantId ? [customerId, tenantId] : [customerId],
    );
    if (!result.rows[0]) return null;
    const customer = this.mapRow(result.rows[0]);
    const details = await this.loadDetailRecords(client, customerId);
    return { ...customer, ...details };
  }

  private async loadDetailRecords(client: any, customerId: string) {
    const [contactsRows, officeRows, taxRows, otherRows] = await Promise.all([
      client.query(
       `SELECT id, customer_id AS "customerId", contact_person AS "contactPerson", designation, mobile, email, created_at AS "createdAt", updated_at AS "updatedAt"
         FROM customer_contacts WHERE customer_id = $1 ORDER BY sort_order, created_at`,
       [customerId],
      ),
      client.query(
       `SELECT id, customer_id AS "customerId", name, address, address_1 AS "address1", city, pincode, state,
           fax_no AS "faxNo", phone, email, mobile, contact, designation, website, weekly_off AS "weeklyOff",
           pan_no AS "panNo", gst_no AS "gstNo", created_at AS "createdAt", updated_at AS "updatedAt"
        FROM customer_offices WHERE customer_id = $1`,
       [customerId],
      ),
      client.query(
       `SELECT id, customer_id AS "customerId", tax_category AS "taxCategory", payment_terms AS "paymentTerms",
           credit_days AS "creditDays", tax_registration_type AS "taxRegistrationType",
           created_at AS "createdAt", updated_at AS "updatedAt"
        FROM customer_tax_payment_terms WHERE customer_id = $1`,
       [customerId],
      ),
      client.query(
       `SELECT id, customer_id AS "customerId", notes, reference, remarks,
           created_at AS "createdAt", updated_at AS "updatedAt"
        FROM customer_other_details WHERE customer_id = $1`,
       [customerId],
      ),
    ]);
    return {
      contacts: contactsRows.rows,
      officeDetails: officeRows.rows[0] ?? null,
      taxPaymentTerms: taxRows.rows[0] ?? null,
      otherDetails: otherRows.rows[0] ?? null,
    };
  }

  private customerFieldOrder() {
    return [
      'code','name','shortName','customerType','customerCategory','zone','domesticExport','inUse','merchantExporter','insurance','nda',
      'startDate','expiryDate','address','address1','city','pincode','country','state','district','panNo','gstNo','vatNo','cstNo',
      'serviceTaxNo','eccCode','fax','phone','mobile','email','contactPerson','designation','website','interestPercent','outstandingLimit',
      'agingLimit','cashDiscountPercent','supplierCode','industryType','discountApplicable','bankName','bankAddress','bankAddress1','bankAccountNo',
      'range','commissionerate','division','referenceCustomer','documentThrough','dealerName','dealerAddress','dealerAddress1','weeklyOff',
      'groupCustomer','distanceInKm','marketingBy','salesmanName'
    ];
  }

  private dbColumnFor(field: string) {
    const map: Record<string, string> = {
      code: 'code', name: 'name', shortName: 'short_name', customerType: 'customer_type', customerCategory: 'customer_category', zone: 'zone', domesticExport: 'domestic_export', inUse: 'in_use', merchantExporter: 'merchant_exporter', insurance: 'insurance', nda: 'nda', startDate: 'start_date', expiryDate: 'expiry_date', address: 'address', address1: 'address_1', city: 'city', pincode: 'pincode', country: 'country', state: 'state', district: 'district', panNo: 'pan_no', gstNo: 'gst_no', vatNo: 'vat_no', cstNo: 'cst_no', serviceTaxNo: 'service_tax_no', eccCode: 'ecc_code', fax: 'fax', phone: 'phone', mobile: 'mobile', email: 'email', contactPerson: 'contact_person', designation: 'designation', website: 'website', interestPercent: 'interest_percent', outstandingLimit: 'outstanding_limit', agingLimit: 'aging_limit', cashDiscountPercent: 'cash_discount_percent', supplierCode: 'supplier_code', industryType: 'industry_type', discountApplicable: 'discount_applicable', bankName: 'bank_name', bankAddress: 'bank_address', bankAddress1: 'bank_address_1', bankAccountNo: 'bank_account_no', range: 'range', commissionerate: 'commissionerate', division: 'division', referenceCustomer: 'reference_customer', documentThrough: 'document_through', dealerName: 'dealer_name', dealerAddress: 'dealer_address', dealerAddress1: 'dealer_address_1', weeklyOff: 'weekly_off', groupCustomer: 'group_customer', distanceInKm: 'distance_in_km', marketingBy: 'marketing_by', salesmanName: 'salesman_name', taxCategory: 'tax_category', paymentTerms: 'payment_terms', creditDays: 'credit_days', taxRegistrationType: 'tax_registration_type', notes: 'notes', reference: 'reference', remarks: 'remarks'};
    return map[field] ?? field;
  }

  private normalizeDbValue(field: string, value: unknown) {
    if (field === 'inUse' || field === 'merchantExporter' || field === 'insurance' || field === 'nda' || field === 'discountApplicable') return Boolean(value);
    if (field === 'interestPercent' || field === 'outstandingLimit' || field === 'agingLimit' || field === 'cashDiscountPercent' || field === 'distanceInKm') return Number(value);
    if (field === 'startDate' || field === 'expiryDate') return value instanceof Date ? value.toISOString() : value;
    return value;
  }

  private versionCondition(input: Record<string, unknown>, paramIndex: number) {
    if (input.expectedVersion === undefined) return '';
    return `AND version = $${paramIndex}`;
  }

  private toNullableString(value: unknown): string | null {
    if (value === undefined || value === null || value === '') return null;
    return String(value).trim() || null;
  }

  private mapRow(row: Record<string, unknown>): CustomerRecord {
    return {
      id: String(row.id),
      tenantId: String(row.tenantId),
      code: row.code ? String(row.code) : null,
      name: String(row.name),
      shortName: row.shortName ? String(row.shortName) : null,
      customerType: row.customerType ? String(row.customerType) : null,
      customerCategory: row.customerCategory ? String(row.customerCategory) : null,
      zone: row.zone ? String(row.zone) : null,
      domesticExport: row.domesticExport ? String(row.domesticExport) : null,
      inUse: row.inUse !== undefined ? Boolean(row.inUse) : null,
      merchantExporter: row.merchantExporter !== undefined ? Boolean(row.merchantExporter) : null,
      insurance: row.insurance !== undefined ? Boolean(row.insurance) : null,
      nda: row.nda !== undefined ? Boolean(row.nda) : null,
      startDate: row.startDate ? String(row.startDate) : null,
      expiryDate: row.expiryDate ? String(row.expiryDate) : null,
      address: row.address ? String(row.address) : null,
      address1: row.address1 ? String(row.address1) : null,
      city: row.city ? String(row.city) : null,
      pincode: row.pincode ? String(row.pincode) : null,
      country: row.country ? String(row.country) : null,
      state: row.state ? String(row.state) : null,
      district: row.district ? String(row.district) : null,
      panNo: row.panNo ? String(row.panNo) : null,
      gstNo: row.gstNo ? String(row.gstNo) : null,
      vatNo: row.vatNo ? String(row.vatNo) : null,
      cstNo: row.cstNo ? String(row.cstNo) : null,
      serviceTaxNo: row.serviceTaxNo ? String(row.serviceTaxNo) : null,
      eccCode: row.eccCode ? String(row.eccCode) : null,
      fax: row.fax ? String(row.fax) : null,
      phone: row.phone ? String(row.phone) : null,
      mobile: row.mobile ? String(row.mobile) : null,
      email: row.email ? String(row.email) : null,
      contactPerson: row.contactPerson ? String(row.contactPerson) : null,
      designation: row.designation ? String(row.designation) : null,
      website: row.website ? String(row.website) : null,
      interestPercent: row.interestPercent !== null && row.interestPercent !== undefined ? Number(row.interestPercent) : null,
      outstandingLimit: row.outstandingLimit !== null && row.outstandingLimit !== undefined ? Number(row.outstandingLimit) : null,
      agingLimit: row.agingLimit !== null && row.agingLimit !== undefined ? Number(row.agingLimit) : null,
      cashDiscountPercent: row.cashDiscountPercent !== null && row.cashDiscountPercent !== undefined ? Number(row.cashDiscountPercent) : null,
      supplierCode: row.supplierCode ? String(row.supplierCode) : null,
      industryType: row.industryType ? String(row.industryType) : null,
      discountApplicable: row.discountApplicable !== undefined ? Boolean(row.discountApplicable) : null,
      bankName: row.bankName ? String(row.bankName) : null,
      bankAddress: row.bankAddress ? String(row.bankAddress) : null,
      bankAddress1: row.bankAddress1 ? String(row.bankAddress1) : null,
      bankAccountNo: row.bankAccountNo ? String(row.bankAccountNo) : null,
      range: row.range ? String(row.range) : null,
      commissionerate: row.commissionerate ? String(row.commissionerate) : null,
      division: row.division ? String(row.division) : null,
      referenceCustomer: row.referenceCustomer ? String(row.referenceCustomer) : null,
      documentThrough: row.documentThrough ? String(row.documentThrough) : null,
      dealerName: row.dealerName ? String(row.dealerName) : null,
      dealerAddress: row.dealerAddress ? String(row.dealerAddress) : null,
      dealerAddress1: row.dealerAddress1 ? String(row.dealerAddress1) : null,
      weeklyOff: row.weeklyOff ? String(row.weeklyOff) : null,
      groupCustomer: row.groupCustomer ? String(row.groupCustomer) : null,
      distanceInKm: row.distanceInKm !== null && row.distanceInKm !== undefined ? Number(row.distanceInKm) : null,
      marketingBy: row.marketingBy ? String(row.marketingBy) : null,
      salesmanName: row.salesmanName ? String(row.salesmanName) : null,
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
