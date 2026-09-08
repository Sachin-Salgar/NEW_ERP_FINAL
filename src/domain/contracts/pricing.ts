export type PriceListStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export interface PriceListItemRecord {
  id: string;
  priceListId: string;
  itemCode: string;
  unitOfMeasure: string;
  price: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  versionNumber: number;
}
export interface PriceListRecord {
  id: string;
  tenantId: string;
  branchId: string | null;
  code: string;
  name: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: PriceListStatus;
  versionNumber: number;
  items: PriceListItemRecord[];
  createdAt: Date;
  updatedAt: Date | null;
}
export interface PriceListRepository {
  create(i: {
    tenantId: string;
    branchId: string | null;
    code: string;
    name: string;
    currency: string;
    effectiveFrom: string;
    effectiveTo?: string | null;
    actorUserId: string;
  }): Promise<PriceListRecord>;
  getById(t: string, id: string): Promise<PriceListRecord | null>;
  list(t: string): Promise<PriceListRecord[]>;
  addItem(i: {
    tenantId: string;
    priceListId: string;
    itemCode: string;
    unitOfMeasure: string;
    price: number;
    effectiveFrom: string;
    effectiveTo?: string | null;
    actorUserId: string;
  }): Promise<PriceListItemRecord>;
  resolvePrice(i: {
    tenantId: string;
    branchId: string;
    itemCode: string;
    unitOfMeasure: string;
    asOf: string;
  }): Promise<PriceListItemRecord | null>;
  update(i: {
    tenantId: string;
    id: string;
    name: string;
    effectiveTo?: string | null;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<PriceListRecord | null>;
  transition(i: {
    tenantId: string;
    id: string;
    status: PriceListStatus;
    expectedVersion: number;
    actorUserId: string;
  }): Promise<PriceListRecord | null>;
}
