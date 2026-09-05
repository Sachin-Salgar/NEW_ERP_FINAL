export type DiscountStatus='DRAFT'|'PUBLISHED'|'ARCHIVED';
export interface DiscountRuleRecord{id:string;tenantId:string;organizationId:string;code:string;name:string;percentage:number;effectiveFrom:string;effectiveTo:string|null;status:DiscountStatus;versionNumber:number;createdAt:Date;updatedAt:Date|null;}
export interface DiscountRuleRepository{create(i:any):Promise<DiscountRuleRecord>;list(t:string,o:string):Promise<DiscountRuleRecord[]>;transition(i:any):Promise<DiscountRuleRecord|null>;}
