export type DiscountStatus='DRAFT'|'PUBLISHED'|'ARCHIVED';
export interface DiscountRuleRecord{id:string;tenantId:string;organizationId:string;code:string;name:string;percentage:number;effectiveFrom:string;effectiveTo:string|null;status:DiscountStatus;versionNumber:number;createdAt:Date;updatedAt:Date|null;}
export interface DiscountCreateInput{tenantId:string;organizationId:string;code:string;name:string;percentage:number;effectiveFrom:string;effectiveTo:string|null;actorUserId:string;}
export interface DiscountTransitionInput{tenantId:string;organizationId:string;id:string;status:DiscountStatus;expectedVersion:number;actorUserId:string;}
export interface DiscountRuleRepository{create(i:DiscountCreateInput):Promise<DiscountRuleRecord>;list(t:string,o:string):Promise<DiscountRuleRecord[]>;transition(i:DiscountTransitionInput):Promise<DiscountRuleRecord|null>;}
