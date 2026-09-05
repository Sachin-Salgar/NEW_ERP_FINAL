export type PriceListStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export interface PriceListRecord { id:string; tenantId:string; organizationId:string; branchId:string|null; code:string; name:string; currency:string; effectiveFrom:string; effectiveTo:string|null; status:PriceListStatus; versionNumber:number; createdAt:Date; updatedAt:Date|null; }
export interface PriceListRepository {
  create(i:{tenantId:string;organizationId:string;branchId:string|null;code:string;name:string;currency:string;effectiveFrom:string;effectiveTo?:string|null;actorUserId:string}):Promise<PriceListRecord>;
  getById(t:string,o:string,id:string):Promise<PriceListRecord|null>; list(t:string,o:string):Promise<PriceListRecord[]>;
  update(i:{tenantId:string;organizationId:string;id:string;name:string;effectiveTo?:string|null;expectedVersion:number;actorUserId:string}):Promise<PriceListRecord|null>;
  transition(i:{tenantId:string;organizationId:string;id:string;status:PriceListStatus;expectedVersion:number;actorUserId:string}):Promise<PriceListRecord|null>;
}
