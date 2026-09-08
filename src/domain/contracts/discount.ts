export type DiscountStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export interface DiscountRuleRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  percentage: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: DiscountStatus;
  versionNumber: number;
  createdAt: Date;
  updatedAt: Date | null;
}
export interface ResolvedDiscountRule {
  id: string;
  code: string;
  percentage: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  versionNumber: number;
}
export interface DiscountCreateInput {
  tenantId: string;
  code: string;
  name: string;
  percentage: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  actorUserId: string;
}
export interface DiscountTransitionInput {
  tenantId: string;
  id: string;
  status: DiscountStatus;
  expectedVersion: number;
  actorUserId: string;
}
export interface DiscountUpdateInput {
  tenantId: string;
  id: string;
  name: string;
  percentage: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  expectedVersion: number;
  actorUserId: string;
}
export interface DiscountRuleRepository {
  create(i: DiscountCreateInput): Promise<DiscountRuleRecord>;
  list(t: string): Promise<DiscountRuleRecord[]>;
  get(t: string, id: string): Promise<DiscountRuleRecord | null>;
  transition(i: DiscountTransitionInput): Promise<DiscountRuleRecord | null>;
  update(i: DiscountUpdateInput): Promise<DiscountRuleRecord | null>;
  resolve(t: string, asOf: string): Promise<ResolvedDiscountRule | null>;
}
