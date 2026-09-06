import { validate as isUuid } from 'uuid';
import type { AuditLogger } from '../contracts/audit.js';
import type { InventoryDependencyPort } from '../../domain/contracts/inventory.js';
import {
  PROCUREMENT_MODULE_CODE,
  PROCUREMENT_PERMISSIONS,
  type ProcurementContext,
  type ProcurementLineInput,
  type ProcurementPermission,
  type ProcurementRepository,
} from '../../domain/contracts/procurement.js';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../domain/errors.js';

export class ProcurementService {
  constructor(
    private readonly repository: ProcurementRepository,
    private readonly authorization: {
      hasPermission(tenantId: string, userId: string, permission: ProcurementPermission): Promise<boolean>;
    },
    private readonly modules: {
      isModuleEnabled(tenantId: string, organizationId: string, moduleCode: string): Promise<boolean>;
    },
    private readonly audit: AuditLogger,
    private readonly tx: { runInTransaction<T>(callback: () => Promise<T>): Promise<T> },
    private readonly inventory: InventoryDependencyPort,
  ) {}

  createSupplier(c: ProcurementContext, input: { name: string; code?: string; email?: string }) {
    return this.write(c, PROCUREMENT_PERMISSIONS.supplierCreate, 'procurement.supplier.created', 'supplier', () =>
      this.repository.createSupplier({
        ...c,
        name: this.text(input.name, 'Supplier name'),
        code: input.code?.trim(),
        email: input.email?.trim(),
      }),
    );
  }
  listSuppliers(c: ProcurementContext, page: number, pageSize: number) {
    return this.read(c, PROCUREMENT_PERMISSIONS.supplierRead, () => this.repository.listSuppliers(c, page, pageSize));
  }
  getSupplier(c: ProcurementContext, id: string) {
    this.id(id, 'Supplier ID');
    return this.read(c, PROCUREMENT_PERMISSIONS.supplierRead, () => this.repository.getSupplier(c, id));
  }
  updateSupplier(c: ProcurementContext, input: { id: string; name: string; email?: string; expectedVersion: number }) {
    this.id(input.id, 'Supplier ID');
    return this.write(c, PROCUREMENT_PERMISSIONS.supplierUpdate, 'procurement.supplier.updated', 'supplier', () =>
      this.repository.updateSupplier({ ...c, ...input, name: this.text(input.name, 'Supplier name') }),
    );
  }
  deleteSupplier(c: ProcurementContext, input: { id: string; expectedVersion: number }) {
    this.id(input.id, 'Supplier ID');
    return this.write(c, PROCUREMENT_PERMISSIONS.supplierDelete, 'procurement.supplier.deleted', 'supplier', () =>
      this.repository.deleteSupplier({ ...c, ...input }),
    );
  }
  createRequisition(
    c: ProcurementContext,
    input: { requiredDate: string; justification?: string; lines: ProcurementLineInput[] },
  ) {
    this.lines(input.lines);
    return this.write(
      c,
      PROCUREMENT_PERMISSIONS.requisitionCreate,
      'procurement.requisition.created',
      'purchase_requisition',
      () =>
        this.repository.createRequisition({
          ...c,
          requiredDate: this.text(input.requiredDate, 'Required date'),
          justification: input.justification?.trim(),
          lines: input.lines,
        }),
    );
  }
  listRequisitions(c: ProcurementContext, page: number, pageSize: number) {
    return this.read(c, PROCUREMENT_PERMISSIONS.requisitionRead, () =>
      this.repository.listRequisitions(c, page, pageSize),
    );
  }
  getRequisition(c: ProcurementContext, id: string) {
    this.id(id, 'Requisition ID');
    return this.read(c, PROCUREMENT_PERMISSIONS.requisitionRead, () => this.repository.getRequisition(c, id));
  }
  updateRequisition(
    c: ProcurementContext,
    input: { id: string; requiredDate: string; justification?: string; expectedVersion: number },
  ) {
    this.id(input.id, 'Requisition ID');
    return this.write(
      c,
      PROCUREMENT_PERMISSIONS.requisitionUpdate,
      'procurement.requisition.updated',
      'purchase_requisition',
      () =>
        this.repository.updateRequisition({
          ...c,
          ...input,
          requiredDate: this.text(input.requiredDate, 'Required date'),
        }),
    );
  }
  transitionRequisition(c: ProcurementContext, input: { id: string; status: string; expectedVersion: number }) {
    return this.transition(c, PROCUREMENT_PERMISSIONS.requisitionWorkflow, 'requisition', input, (value) =>
      this.repository.transitionRequisition({ ...c, ...value }),
    );
  }
  submitRequisition(c: ProcurementContext, i: { id: string; expectedVersion: number }) {
    return this.transition(
      c,
      PROCUREMENT_PERMISSIONS.requisitionSubmit,
      'requisition',
      { ...i, status: 'SUBMITTED' },
      (v) => this.repository.transitionRequisition({ ...c, ...v }),
    );
  }
  approveRequisition(c: ProcurementContext, i: { id: string; expectedVersion: number }) {
    return this.transition(
      c,
      PROCUREMENT_PERMISSIONS.requisitionApprove,
      'requisition',
      { ...i, status: 'APPROVED' },
      (v) => this.repository.transitionRequisition({ ...c, ...v }),
    );
  }
  rejectRequisition(c: ProcurementContext, i: { id: string; expectedVersion: number }) {
    return this.transition(
      c,
      PROCUREMENT_PERMISSIONS.requisitionReject,
      'requisition',
      { ...i, status: 'REJECTED' },
      (v) => this.repository.transitionRequisition({ ...c, ...v }),
    );
  }
  cancelRequisition(c: ProcurementContext, i: { id: string; expectedVersion: number }) {
    return this.transition(
      c,
      PROCUREMENT_PERMISSIONS.requisitionCancel,
      'requisition',
      { ...i, status: 'CANCELLED' },
      (v) => this.repository.transitionRequisition({ ...c, ...v }),
    );
  }
  createPurchaseOrder(
    c: ProcurementContext,
    input: { supplierId: string; requisitionId?: string; orderDate: string; lines: ProcurementLineInput[] },
  ) {
    this.id(input.supplierId, 'Supplier ID');
    if (input.requisitionId) this.id(input.requisitionId, 'Requisition ID');
    this.lines(input.lines);
    return this.write(
      c,
      PROCUREMENT_PERMISSIONS.purchaseOrderCreate,
      'procurement.purchase_order.created',
      'purchase_order',
      () =>
        this.repository.createPurchaseOrder({
          ...c,
          supplierId: input.supplierId,
          requisitionId: input.requisitionId,
          orderDate: this.text(input.orderDate, 'Order date'),
          lines: input.lines,
        }),
    );
  }
  listPurchaseOrders(c: ProcurementContext, page: number, pageSize: number) {
    return this.read(c, PROCUREMENT_PERMISSIONS.purchaseOrderRead, () =>
      this.repository.listPurchaseOrders(c, page, pageSize),
    );
  }
  getPurchaseOrder(c: ProcurementContext, id: string) {
    this.id(id, 'Purchase order ID');
    return this.read(c, PROCUREMENT_PERMISSIONS.purchaseOrderRead, () => this.repository.getPurchaseOrder(c, id));
  }
  updatePurchaseOrder(c: ProcurementContext, input: { id: string; orderDate: string; expectedVersion: number }) {
    this.id(input.id, 'Purchase order ID');
    return this.write(
      c,
      PROCUREMENT_PERMISSIONS.purchaseOrderUpdate,
      'procurement.order.updated',
      'purchase_order',
      () =>
        this.repository.updatePurchaseOrder({ ...c, ...input, orderDate: this.text(input.orderDate, 'Order date') }),
    );
  }
  transitionPurchaseOrder(c: ProcurementContext, input: { id: string; status: string; expectedVersion: number }) {
    return this.transition(c, PROCUREMENT_PERMISSIONS.purchaseOrderWorkflow, 'order', input, (value) =>
      this.repository.transitionPurchaseOrder({ ...c, ...value }),
    );
  }
  submitPurchaseOrder(c: ProcurementContext, i: { id: string; expectedVersion: number }) {
    return this.transition(
      c,
      PROCUREMENT_PERMISSIONS.purchaseOrderSubmit,
      'order',
      { ...i, status: 'SUBMITTED' },
      (v) => this.repository.transitionPurchaseOrder({ ...c, ...v }),
    );
  }
  approvePurchaseOrder(c: ProcurementContext, i: { id: string; expectedVersion: number }) {
    return this.transition(
      c,
      PROCUREMENT_PERMISSIONS.purchaseOrderApprove,
      'order',
      { ...i, status: 'APPROVED' },
      (v) => this.repository.transitionPurchaseOrder({ ...c, ...v }),
    );
  }
  rejectPurchaseOrder(c: ProcurementContext, i: { id: string; expectedVersion: number }) {
    return this.transition(c, PROCUREMENT_PERMISSIONS.purchaseOrderReject, 'order', { ...i, status: 'REJECTED' }, (v) =>
      this.repository.transitionPurchaseOrder({ ...c, ...v }),
    );
  }
  cancelPurchaseOrder(c: ProcurementContext, i: { id: string; expectedVersion: number }) {
    return this.transition(
      c,
      PROCUREMENT_PERMISSIONS.purchaseOrderCancel,
      'order',
      { ...i, status: 'CANCELLED' },
      (v) => this.repository.transitionPurchaseOrder({ ...c, ...v }),
    );
  }
  async createReceipt(
    c: ProcurementContext,
    input: {
      purchaseOrderId: string;
      warehouseId: string;
      receiptDate: string;
      lines: Array<{ itemId: string; quantity: number }>;
      operationKey: string;
    },
  ) {
    this.id(input.purchaseOrderId, 'Purchase order ID');
    this.id(input.warehouseId, 'Warehouse ID');
    if (
      !input.lines.length ||
      input.lines.some((line) => !isUuid(line.itemId) || !Number.isFinite(line.quantity) || line.quantity <= 0)
    )
      throw new ValidationError('Receipt lines must contain valid items and positive quantities.');
    if (!input.operationKey?.trim()) throw new ValidationError('Operation key is required.');
    await this.authorize(c, PROCUREMENT_PERMISSIONS.receiptCreate);
    return this.tx.runInTransaction(async () => {
      const receipt = await this.repository.createReceipt({ ...c, ...input });
      await this.audit.record(
        {
          tenantId: c.tenantId,
          actorUserId: c.userId,
          action: 'procurement.receipt.created',
          resourceType: 'purchase_receipt',
          resourceId: receipt.id,
          outcome: 'success',
        },
        { requireTransaction: true },
      );
      return receipt;
    });
  }
  getReceipt(c: ProcurementContext, id: string) {
    this.id(id, 'Receipt ID');
    return this.read(c, PROCUREMENT_PERMISSIONS.receiptRead, () => this.repository.getReceipt(c, id));
  }
  listReceipts(c: ProcurementContext, page: number, pageSize: number) {
    return this.read(c, PROCUREMENT_PERMISSIONS.receiptRead, () => this.repository.listReceipts(c, page, pageSize));
  }
  updateReceipt(
    c: ProcurementContext,
    input: {
      id: string;
      warehouseId: string;
      receiptDate: string;
      lines: Array<{ itemId: string; quantity: number }>;
      expectedVersion: number;
    },
  ) {
    this.id(input.id, 'Receipt ID');
    this.id(input.warehouseId, 'Warehouse ID');
    this.receiptLines(input.lines);
    return this.write(c, PROCUREMENT_PERMISSIONS.receiptUpdate, 'procurement.receipt.updated', 'purchase_receipt', () =>
      this.repository.updateReceipt({ ...c, ...input, receiptDate: this.text(input.receiptDate, 'Receipt date') }),
    );
  }
  transitionReceipt(c: ProcurementContext, input: { id: string; status: string; expectedVersion: number }) {
    return this.transition(c, PROCUREMENT_PERMISSIONS.receiptWorkflow, 'receipt', input, (value) =>
      this.repository.transitionReceipt({ ...c, ...value }),
    );
  }
  completeReceipt(c: ProcurementContext, i: { id: string; expectedVersion: number }) {
    this.id(i.id, 'Receipt ID');
    return this.tx.runInTransaction(async () => {
      await this.authorize(c, PROCUREMENT_PERMISSIONS.receiptComplete);
      const result = await this.repository.completeReceipt({ ...c, ...i });
      if (!result) throw new NotFoundError('Receipt not found.');
      if (!result.alreadyCompleted) {
        if (!this.inventory.receiveStock) throw new ValidationError('Inventory receipt integration is unavailable.');
        const receipt = result.receipt as {
          warehouse_id?: string;
          warehouseId?: string;
          operation_key?: string;
          operationKey?: string;
        };
        const warehouseId = String(receipt.warehouseId ?? receipt.warehouse_id);
        const operationKey = String(receipt.operationKey ?? receipt.operation_key);
        for (const line of result.lines)
          await this.inventory.receiveStock(c, {
            warehouseId,
            itemId: line.itemId,
            quantity: line.quantity,
            sourceType: 'PURCHASE_RECEIPT',
            sourceId: i.id,
            operationKey: `${operationKey}:${line.itemId}`,
          });
        await this.audit.record(
          {
            tenantId: c.tenantId,
            actorUserId: c.userId,
            action: 'procurement.receipt.completed',
            resourceType: 'purchase_receipt',
            resourceId: i.id,
            outcome: 'success',
          },
          { requireTransaction: true },
        );
      }
      return result.receipt;
    });
  }
  cancelReceipt(c: ProcurementContext, i: { id: string; expectedVersion: number }) {
    this.id(i.id, 'Receipt ID');
    return this.write(
      c,
      PROCUREMENT_PERMISSIONS.receiptCancel,
      'procurement.receipt.cancelled',
      'purchase_receipt',
      async () => {
        const result = await this.repository.cancelReceipt({ ...c, ...i });
        if (!result) throw new NotFoundError('Receipt not found or is not a draft.');
        return result;
      },
    );
  }
  private async read<T>(c: ProcurementContext, p: ProcurementPermission, fn: () => Promise<T>) {
    await this.authorize(c, p);
    return fn();
  }
  private async write<T>(
    c: ProcurementContext,
    p: ProcurementPermission,
    action: string,
    type: string,
    fn: () => Promise<T>,
  ) {
    await this.authorize(c, p);
    return this.tx.runInTransaction(async () => {
      const result = await fn();
      if (result === null || result === undefined)
        throw new NotFoundError('Requested procurement resource was not found.');
      const id = String((result as unknown as { id: string }).id);
      await this.audit.record(
        { tenantId: c.tenantId, actorUserId: c.userId, action, resourceType: type, resourceId: id, outcome: 'success' },
        { requireTransaction: true },
      );
      return result;
    });
  }
  private async transition(
    c: ProcurementContext,
    permission: ProcurementPermission,
    type: string,
    input: { id: string; status: string; expectedVersion: number },
    fn: (value: { id: string; status: string; expectedVersion: number }) => Promise<unknown>,
  ) {
    this.id(input.id, `${type} ID`);
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1)
      throw new ValidationError('Expected version is required.');
    const allowed: Record<string, string[]> = {
      requisition: ['SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED'],
      order: ['SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED'],
      receipt: ['CANCELLED'],
    };
    if (!allowed[type]?.includes(input.status)) throw new ValidationError(`Invalid ${type} lifecycle transition.`);
    await this.authorize(c, permission);
    const actionPermission =
      type === 'requisition'
        ? input.status === 'SUBMITTED'
          ? PROCUREMENT_PERMISSIONS.requisitionSubmit
          : input.status === 'APPROVED'
            ? PROCUREMENT_PERMISSIONS.requisitionApprove
            : input.status === 'REJECTED'
              ? PROCUREMENT_PERMISSIONS.requisitionReject
              : PROCUREMENT_PERMISSIONS.requisitionCancel
        : type === 'order'
          ? input.status === 'SUBMITTED'
            ? PROCUREMENT_PERMISSIONS.purchaseOrderSubmit
            : input.status === 'APPROVED'
              ? PROCUREMENT_PERMISSIONS.purchaseOrderApprove
              : input.status === 'REJECTED'
                ? PROCUREMENT_PERMISSIONS.purchaseOrderReject
                : PROCUREMENT_PERMISSIONS.purchaseOrderCancel
          : PROCUREMENT_PERMISSIONS.receiptCancel;
    if (actionPermission !== permission) await this.authorize(c, actionPermission);
    return this.tx.runInTransaction(async () => {
      const current =
        type === 'requisition'
          ? await this.repository.getRequisition(c, input.id)
          : type === 'order'
            ? await this.repository.getPurchaseOrder(c, input.id)
            : await this.repository.getReceipt(c, input.id);
      if (!current) throw new NotFoundError(`${type} not found.`);
      const currentStatus = String((current as { status?: string } | null)?.status ?? '');
      const transitions: Record<string, Record<string, string[]>> = {
        requisition: { DRAFT: ['SUBMITTED', 'CANCELLED'], SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'] },
        order: {
          DRAFT: ['SUBMITTED', 'CANCELLED'],
          SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
        },
        receipt: { DRAFT: ['CANCELLED'] },
      };
      if (!transitions[type]?.[currentStatus]?.includes(input.status))
        throw new ValidationError(`Invalid ${type} lifecycle transition from ${currentStatus || 'missing'}.`);
      const result = await fn(input);
      if (result === null || result === undefined)
        throw new ValidationError(`${type} was modified concurrently or is no longer available.`);
      return result;
    });
  }
  private async authorize(c: ProcurementContext, p: ProcurementPermission) {
    if (!c.userId?.trim()) throw new UnauthorizedError();
    for (const [value, label] of [
      [c.tenantId, 'Tenant ID'],
      [c.organizationId, 'Organization ID'],
      [c.branchId, 'Branch ID'],
      [c.financialYearId, 'Financial year ID'],
      [c.userId, 'User ID'],
    ] as const)
      this.id(value, label);
    if (!(await this.modules.isModuleEnabled(c.tenantId, c.organizationId, PROCUREMENT_MODULE_CODE)))
      throw new ForbiddenError('Procurement module is not enabled.');
    if (!(await this.authorization.hasPermission(c.tenantId, c.userId, p)))
      throw new ForbiddenError('Insufficient Procurement permission.');
  }
  private lines(lines: ProcurementLineInput[]) {
    if (
      !Array.isArray(lines) ||
      !lines.length ||
      lines.some(
        (l) =>
          !isUuid(l.itemId) ||
          !this.text(l.description, 'Line description') ||
          !Number.isFinite(l.quantity) ||
          l.quantity <= 0 ||
          !this.text(l.unitOfMeasure, 'Unit of measure'),
      )
    )
      throw new ValidationError('Valid purchase lines are required.');
  }
  private receiptLines(lines: Array<{ itemId: string; quantity: number }>) {
    if (
      !Array.isArray(lines) ||
      !lines.length ||
      lines.some((line) => !isUuid(line.itemId) || !Number.isFinite(line.quantity) || line.quantity <= 0)
    )
      throw new ValidationError('Receipt lines must contain valid items and positive quantities.');
  }
  private text(value: string | undefined, label: string) {
    const v = value?.trim();
    if (!v || v.length > 500) throw new ValidationError(`${label} is required.`);
    return v;
  }
  private id(value: string, label: string) {
    if (!value || !isUuid(value)) throw new ValidationError(`${label} must be a valid UUID.`);
  }
}
