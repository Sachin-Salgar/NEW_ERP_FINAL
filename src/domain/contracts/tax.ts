export const TAX_PERMISSIONS = {
  read: 'tax.configuration.read',
  create: 'tax.configuration.create',
  update: 'tax.configuration.update',
  activate: 'tax.configuration.activate',
  deactivate: 'tax.configuration.deactivate',
} as const;

export type TaxStatus = 'ACTIVE' | 'INACTIVE';

export interface TaxContext {
  tenantId: string;
  organizationId: string;
  userId: string;
}

export interface TaxRuleRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  code: string;
  name: string;
  rate: number;
  status: TaxStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  versionNumber: number;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface TaxResolution {
  ruleId: string;
  code: string;
  rate: number;
  taxAmount: number;
  effectiveDate: string;
}

export interface TaxRepository {
  create(input: Omit<TaxRuleRecord, 'id' | 'tenantId' | 'versionNumber' | 'createdAt' | 'updatedAt' | 'status'> & TaxContext): Promise<TaxRuleRecord>;
  list(tenantId: string, organizationId: string): Promise<TaxRuleRecord[]>;
  update(input: TaxContext & { id: string; name: string; rate: number; effectiveTo: string | null; expectedVersion: number }): Promise<TaxRuleRecord | null>;
  setStatus(input: TaxContext & { id: string; status: TaxStatus; expectedVersion: number }): Promise<TaxRuleRecord | null>;
  resolve(input: TaxContext & { asOf: string }): Promise<TaxRuleRecord | null>;
}
