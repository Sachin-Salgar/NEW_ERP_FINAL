export type DiscountStatus='DRAFT'|'PUBLISHED'|'ARCHIVED';
export interface DiscountRuleRecord{id:string;tenantId:string;organizationId:string;code:string;name:string;percentage:number;effectiveFrom:string;effectiveTo:string|null;status:DiscountStatus;versionNumber:number;createdAt:Date;updatedAt:Date|null;}
export interface ResolvedDiscountRule {
  id: string;
  code: string;
  percentage: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  versionNumber: number;
}
export interface DiscountCreateInput{tenantId:string;organizationId:string;code:string;name:string;percentage:number;effectiveFrom:string;effectiveTo:string|null;actorUserId:string;}
export interface DiscountTransitionInput{tenantId:string;organizationId:string;id:string;status:DiscountStatus;expectedVersion:number;actorUserId:string;}
export interface DiscountUpdateInput{tenantId:string;organizationId:string;id:string;name:string;percentage:number;effectiveFrom:string;effectiveTo:string|null;expectedVersion:number;actorUserId:string;}
export interface DiscountRuleRepository{
  create(i:DiscountCreateInput):Promise<DiscountRuleRecord>;
  list(t:string,o:string):Promise<DiscountRuleRecord[]>;
  transition(i:DiscountTransitionInput):Promise<DiscountRuleRecord|null>;
  update(i:DiscountUpdateInput):Promise<DiscountRuleRecord|null>;
  resolve(t:string,o:string,asOf:string):Promise<ResolvedDiscountRule|null>;
}
