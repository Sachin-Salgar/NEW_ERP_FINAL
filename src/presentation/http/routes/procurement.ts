import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { parsePaginationQuery } from '../pagination.js';
import { ValidationError } from '../../../domain/errors.js';
import { requestParam } from '../request-input.js';

function ctx(r: FastifyRequest) {
  if (!r.tenantId || !r.user?.tenantId || !r.user.branchId || !r.user.financialYearId)
    throw new ValidationError('Authenticated tenant, branch, and financial-year context is required.');
  return {
    tenantId: r.tenantId,
    branchId: r.user.branchId,
    financialYearId: r.user.financialYearId,
    userId: r.user.id,
  };
}
const procurementRoutes: FastifyPluginAsync = async (f) => {
  f.post(
    '/purchase/suppliers',
    { preHandler: [requireAuth, requirePermission('purchase.supplier.create')] },
    async (r, h) => {
      const supplier = await f.procurementService.createSupplier(
        ctx(r),
        r.body as { name: string; code?: string; email?: string },
      );
      h.code(201);
      return { success: true, supplier };
    },
  );
  f.get(
    '/purchase/suppliers',
    { preHandler: [requireAuth, requirePermission('purchase.supplier.read')] },
    async (r) => {
      const p = parsePaginationQuery(r.query);
      const result = await f.procurementService.listSuppliers(ctx(r), p.page, p.pageSize);
      return {
        success: true,
        suppliers: result.items,
        metadata: {
          page: p.page,
          page_size: p.pageSize,
          total: result.total,
          total_pages: Math.ceil(result.total / p.pageSize),
        },
      };
    },
  );
  f.get(
    '/purchase/suppliers/:id',
    { preHandler: [requireAuth, requirePermission('purchase.supplier.read')] },
    async (r) => ({
      success: true,
      supplier: await f.procurementService.getSupplier(ctx(r), requestParam(r.params, 'id') ?? ''),
    }),
  );
  f.patch(
    '/purchase/suppliers/:id',
    { preHandler: [requireAuth, requirePermission('purchase.supplier.update')] },
    async (r) => ({
      success: true,
      supplier: await f.procurementService.updateSupplier(ctx(r), {
        ...(r.body as any),
        id: requestParam(r.params, 'id') ?? '',
      }),
    }),
  );
  f.delete(
    '/purchase/suppliers/:id',
    { preHandler: [requireAuth, requirePermission('purchase.supplier.delete')] },
    async (r) => ({
      success: true,
      supplier: await f.procurementService.deleteSupplier(ctx(r), {
        ...(r.body as any),
        id: requestParam(r.params, 'id') ?? '',
      }),
    }),
  );
  f.post(
    '/purchase/requisitions',
    { preHandler: [requireAuth, requirePermission('purchase.requisition.create')] },
    async (r, h) => {
      const requisition = await f.procurementService.createRequisition(ctx(r), r.body as any);
      h.code(201);
      return { success: true, requisition };
    },
  );
  f.get(
    '/purchase/requisitions',
    { preHandler: [requireAuth, requirePermission('purchase.requisition.read')] },
    async (r) => {
      const p = parsePaginationQuery(r.query);
      const result = await f.procurementService.listRequisitions(ctx(r), p.page, p.pageSize);
      return {
        success: true,
        requisitions: result.items,
        metadata: {
          page: p.page,
          page_size: p.pageSize,
          total: result.total,
          total_pages: Math.ceil(result.total / p.pageSize),
        },
      };
    },
  );
  f.get(
    '/purchase/requisitions/:id',
    { preHandler: [requireAuth, requirePermission('purchase.requisition.read')] },
    async (r) => ({
      success: true,
      requisition: await f.procurementService.getRequisition(ctx(r), requestParam(r.params, 'id') ?? ''),
    }),
  );
  f.patch(
    '/purchase/requisitions/:id',
    { preHandler: [requireAuth, requirePermission('purchase.requisition.update')] },
    async (r) => ({
      success: true,
      requisition: await f.procurementService.updateRequisition(ctx(r), {
        ...(r.body as any),
        id: requestParam(r.params, 'id') ?? '',
      }),
    }),
  );
  f.post(
    '/purchase/requisitions/:id/workflow',
    { preHandler: [requireAuth, requirePermission('purchase.requisition.workflow')] },
    async (r) => ({
      success: true,
      requisition: await f.procurementService.transitionRequisition(ctx(r), {
        ...(r.body as any),
        id: requestParam(r.params, 'id') ?? '',
      }),
    }),
  );
  for (const [action, permission, method] of [
    ['submit', 'purchase.requisition.submit', 'submitRequisition'],
    ['approve', 'purchase.requisition.approve', 'approveRequisition'],
    ['reject', 'purchase.requisition.reject', 'rejectRequisition'],
    ['cancel', 'purchase.requisition.cancel', 'cancelRequisition'],
  ] as const)
    f.post(
      `/purchase/requisitions/:id/${action}`,
      { preHandler: [requireAuth, requirePermission(permission)] },
      async (r) => ({
        success: true,
        requisition: await (f.procurementService as any)[method](ctx(r), {
          ...(r.body as any),
          id: requestParam(r.params, 'id') ?? '',
        }),
      }),
    );
  f.post(
    '/purchase/purchase-orders',
    { preHandler: [requireAuth, requirePermission('purchase.order.create')] },
    async (r, h) => {
      const purchaseOrder = await f.procurementService.createPurchaseOrder(ctx(r), r.body as any);
      h.code(201);
      return { success: true, purchaseOrder };
    },
  );
  f.get(
    '/purchase/purchase-orders',
    { preHandler: [requireAuth, requirePermission('purchase.order.read')] },
    async (r) => {
      const p = parsePaginationQuery(r.query);
      const result = await f.procurementService.listPurchaseOrders(ctx(r), p.page, p.pageSize);
      return {
        success: true,
        purchaseOrders: result.items,
        metadata: {
          page: p.page,
          page_size: p.pageSize,
          total: result.total,
          total_pages: Math.ceil(result.total / p.pageSize),
        },
      };
    },
  );
  f.get(
    '/purchase/purchase-orders/:id',
    { preHandler: [requireAuth, requirePermission('purchase.order.read')] },
    async (r) => ({
      success: true,
      purchaseOrder: await f.procurementService.getPurchaseOrder(ctx(r), requestParam(r.params, 'id') ?? ''),
    }),
  );
  f.patch(
    '/purchase/purchase-orders/:id',
    { preHandler: [requireAuth, requirePermission('purchase.order.update')] },
    async (r) => ({
      success: true,
      purchaseOrder: await f.procurementService.updatePurchaseOrder(ctx(r), {
        ...(r.body as any),
        id: requestParam(r.params, 'id') ?? '',
      }),
    }),
  );
  f.post(
    '/purchase/purchase-orders/:id/workflow',
    { preHandler: [requireAuth, requirePermission('purchase.order.workflow')] },
    async (r) => ({
      success: true,
      purchaseOrder: await f.procurementService.transitionPurchaseOrder(ctx(r), {
        ...(r.body as any),
        id: requestParam(r.params, 'id') ?? '',
      }),
    }),
  );
  for (const [action, permission, method] of [
    ['submit', 'purchase.order.submit', 'submitPurchaseOrder'],
    ['approve', 'purchase.order.approve', 'approvePurchaseOrder'],
    ['reject', 'purchase.order.reject', 'rejectPurchaseOrder'],
    ['cancel', 'purchase.order.cancel', 'cancelPurchaseOrder'],
  ] as const)
    f.post(
      `/purchase/purchase-orders/:id/${action}`,
      { preHandler: [requireAuth, requirePermission(permission)] },
      async (r) => ({
        success: true,
        purchaseOrder: await (f.procurementService as any)[method](ctx(r), {
          ...(r.body as any),
          id: requestParam(r.params, 'id') ?? '',
        }),
      }),
    );
  f.post(
    '/purchase/receipts',
    { preHandler: [requireAuth, requirePermission('purchase.receipt.create')] },
    async (r, h) => {
      const receipt = await f.procurementService.createReceipt(ctx(r), r.body as any);
      h.code(201);
      return { success: true, receipt };
    },
  );
  f.get('/purchase/receipts', { preHandler: [requireAuth, requirePermission('purchase.receipt.read')] }, async (r) => {
    const p = parsePaginationQuery(r.query);
    const result = await f.procurementService.listReceipts(ctx(r), p.page, p.pageSize);
    return {
      success: true,
      receipts: result.items,
      metadata: {
        page: p.page,
        page_size: p.pageSize,
        total: result.total,
        total_pages: Math.ceil(result.total / p.pageSize),
      },
    };
  });
  f.get(
    '/purchase/receipts/:id',
    { preHandler: [requireAuth, requirePermission('purchase.receipt.read')] },
    async (r) => ({
      success: true,
      receipt: await f.procurementService.getReceipt(ctx(r), requestParam(r.params, 'id') ?? ''),
    }),
  );
  f.patch(
    '/purchase/receipts/:id',
    { preHandler: [requireAuth, requirePermission('purchase.receipt.update')] },
    async (r) => ({
      success: true,
      receipt: await f.procurementService.updateReceipt(ctx(r), {
        ...(r.body as Record<string, unknown>),
        id: requestParam(r.params, 'id') ?? '',
      } as Parameters<typeof f.procurementService.updateReceipt>[1]),
    }),
  );
  f.post(
    '/purchase/receipts/:id/workflow',
    { preHandler: [requireAuth, requirePermission('purchase.receipt.workflow')] },
    async (r) => ({
      success: true,
      receipt: await f.procurementService.transitionReceipt(ctx(r), {
        ...(r.body as any),
        id: requestParam(r.params, 'id') ?? '',
      }),
    }),
  );
  f.post(
    '/purchase/receipts/:id/complete',
    { preHandler: [requireAuth, requirePermission('purchase.receipt.complete')] },
    async (r) => ({
      success: true,
      receipt: await f.procurementService.completeReceipt(ctx(r), {
        ...(r.body as any),
        id: requestParam(r.params, 'id') ?? '',
      }),
    }),
  );
  f.post(
    '/purchase/receipts/:id/cancel',
    { preHandler: [requireAuth, requirePermission('purchase.receipt.cancel')] },
    async (r) => ({
      success: true,
      receipt: await f.procurementService.cancelReceipt(ctx(r), {
        ...(r.body as any),
        id: requestParam(r.params, 'id') ?? '',
      }),
    }),
  );
};
export default procurementRoutes;
