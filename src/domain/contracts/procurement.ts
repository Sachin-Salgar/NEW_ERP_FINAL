export const PROCUREMENT_MODULE_CODE = 'purchase';

export const PROCUREMENT_PERMISSIONS = {
  supplierRead: 'purchase.supplier.read',
  supplierCreate: 'purchase.supplier.create',
  supplierUpdate: 'purchase.supplier.update',
  supplierDelete: 'purchase.supplier.delete',
  requisitionRead: 'purchase.requisition.read',
  requisitionCreate: 'purchase.requisition.create',
  requisitionUpdate: 'purchase.requisition.update',
  requisitionSubmit: 'purchase.requisition.submit',
  requisitionApprove: 'purchase.requisition.approve',
  requisitionReject: 'purchase.requisition.reject',
  requisitionCancel: 'purchase.requisition.cancel',
  requisitionWorkflow: 'purchase.requisition.workflow',
  purchaseOrderRead: 'purchase.order.read',
  purchaseOrderCreate: 'purchase.order.create',
  purchaseOrderUpdate: 'purchase.order.update',
  purchaseOrderSubmit: 'purchase.order.submit',
  purchaseOrderApprove: 'purchase.order.approve',
  purchaseOrderReject: 'purchase.order.reject',
  purchaseOrderCancel: 'purchase.order.cancel',
  purchaseOrderWorkflow: 'purchase.order.workflow',
  receiptRead: 'purchase.receipt.read',
  receiptCreate: 'purchase.receipt.create',
  receiptUpdate: 'purchase.receipt.update',
  receiptComplete: 'purchase.receipt.complete',
  receiptCancel: 'purchase.receipt.cancel',
  receiptWorkflow: 'purchase.receipt.workflow',
} as const;

export type ProcurementPermission = (typeof PROCUREMENT_PERMISSIONS)[keyof typeof PROCUREMENT_PERMISSIONS];

export interface ProcurementContext {
  tenantId: string;
  branchId: string;
  financialYearId: string;
  userId: string;
}

export interface ProcurementLineInput {
  itemId: string;
  description: string;
  quantity: number;
  unitPrice?: number;
  unitOfMeasure: string;
}

export interface ProcurementRepository {
  createSupplier(input: ProcurementContext & { name: string; code?: string; email?: string }): Promise<unknown>;
  getSupplier(context: ProcurementContext, id: string): Promise<unknown | null>;
  updateSupplier(
    input: ProcurementContext & { id: string; name: string; email?: string; expectedVersion: number },
  ): Promise<unknown | null>;
  deleteSupplier(input: ProcurementContext & { id: string; expectedVersion: number }): Promise<unknown | null>;
  listSuppliers(
    context: ProcurementContext,
    page: number,
    pageSize: number,
  ): Promise<{ items: unknown[]; total: number }>;
  createRequisition(
    input: ProcurementContext & { requiredDate: string; justification?: string; lines: ProcurementLineInput[] },
  ): Promise<unknown>;
  getRequisition(context: ProcurementContext, id: string): Promise<unknown | null>;
  updateRequisition(
    input: ProcurementContext & { id: string; requiredDate: string; justification?: string; expectedVersion: number },
  ): Promise<unknown | null>;
  transitionRequisition(
    input: ProcurementContext & { id: string; status: string; expectedVersion: number },
  ): Promise<unknown | null>;
  listRequisitions(
    context: ProcurementContext,
    page: number,
    pageSize: number,
  ): Promise<{ items: unknown[]; total: number }>;
  createPurchaseOrder(
    input: ProcurementContext & {
      supplierId: string;
      requisitionId?: string;
      orderDate: string;
      lines: ProcurementLineInput[];
    },
  ): Promise<unknown>;
  getPurchaseOrder(context: ProcurementContext, id: string): Promise<unknown | null>;
  updatePurchaseOrder(
    input: ProcurementContext & { id: string; orderDate: string; expectedVersion: number },
  ): Promise<unknown | null>;
  transitionPurchaseOrder(
    input: ProcurementContext & { id: string; status: string; expectedVersion: number },
  ): Promise<unknown | null>;
  listPurchaseOrders(
    context: ProcurementContext,
    page: number,
    pageSize: number,
  ): Promise<{ items: unknown[]; total: number }>;
  createReceipt(
    input: ProcurementContext & {
      purchaseOrderId: string;
      warehouseId: string;
      receiptDate: string;
      lines: Array<{ itemId: string; quantity: number }>;
      operationKey: string;
    },
  ): Promise<{ id: string; lines: Array<{ itemId: string; quantity: number }> }>;
  updateReceipt(
    input: ProcurementContext & {
      id: string;
      warehouseId: string;
      receiptDate: string;
      lines: Array<{ itemId: string; quantity: number }>;
      expectedVersion: number;
    },
  ): Promise<unknown | null>;
  getReceipt(context: ProcurementContext, id: string): Promise<unknown | null>;
  listReceipts(
    context: ProcurementContext,
    page: number,
    pageSize: number,
  ): Promise<{ items: unknown[]; total: number }>;
  transitionReceipt(
    input: ProcurementContext & { id: string; status: string; expectedVersion: number },
  ): Promise<unknown | null>;
  completeReceipt(input: ProcurementContext & { id: string; expectedVersion: number }): Promise<{
    receipt: unknown;
    lines: Array<{ itemId: string; quantity: number }>;
    alreadyCompleted: boolean;
  } | null>;
  cancelReceipt(input: ProcurementContext & { id: string; expectedVersion: number }): Promise<unknown | null>;
}
