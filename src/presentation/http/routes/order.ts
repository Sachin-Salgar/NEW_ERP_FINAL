import type { FastifyPluginAsync } from 'fastify';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { parsePaginationQuery } from '../pagination.js';
import { requestParam } from '../request-input.js';
import type { OrderRecord } from '../../../domain/contracts/repositories.js';
function ctx(r: any) {
  return {
    tenantId: r.tenantId,
    organizationId: r.user.organizationId,
    branchId: r.user.branchId ?? r.user.defaultBranchId,
    financialYearId: r.user.financialYearId,
    userId: r.user.id,
  };
}
function out(x: OrderRecord) {
  const { tenantId: _t, ...v } = x;
  return v;
}
const orderRoutes: FastifyPluginAsync = async (f) => {
  f.post('/sales/orders', { preHandler: [requireAuth, requirePermission('sales.order.create')] }, async (r: any, h) => {
    const x = await f.orderService.create(ctx(r), r.body);
    h.code(201);
    return { success: true, order: out(x) };
  });
  f.get('/sales/orders', { preHandler: [requireAuth, requirePermission('sales.order.read')] }, async (r: any) => {
    const p = parsePaginationQuery(r.query);
    const x = await f.orderService.list(ctx(r), p);
    return {
      success: true,
      orders: x.items.map(out),
      metadata: {
        page: p.page,
        page_size: p.pageSize,
        total: x.total,
        total_pages: Math.ceil(x.total / p.pageSize),
        order: p.order,
        ...(p.search ? { search: p.search } : {}),
      },
    };
  });
  f.get('/sales/orders/:id', { preHandler: [requireAuth, requirePermission('sales.order.read')] }, async (r: any) => ({
    success: true,
    order: out(await f.orderService.get(ctx(r), requestParam(r.params, 'id') ?? '')),
  }));
  f.patch(
    '/sales/orders/:id',
    { preHandler: [requireAuth, requirePermission('sales.order.update')] },
    async (r: any) => ({
      success: true,
      order: out(await f.orderService.update(ctx(r), requestParam(r.params, 'id') ?? '', r.body)),
    }),
  );
  f.delete(
    '/sales/orders/:id',
    { preHandler: [requireAuth, requirePermission('sales.order.delete')] },
    async (r: any) => ({
      success: true,
      order: out(await f.orderService.delete(ctx(r), requestParam(r.params, 'id') ?? '')),
    }),
  );
  for (const s of ['confirm', 'cancel', 'close'] as const)
    f.post(
      `/sales/orders/:id/${s}`,
      { preHandler: [requireAuth, requirePermission(`sales.order.${s}`)] },
      async (r: any) => ({
        success: true,
        order: out(
          await f.orderService.transition(
            ctx(r),
            requestParam(r.params, 'id') ?? '',
            s === 'confirm' ? 'CONFIRMED' : s === 'cancel' ? 'CANCELLED' : 'CLOSED',
            r.body.expectedVersion,
          ),
        ),
      }),
    );
  f.post(
    '/sales/orders/:id/reserve',
    { preHandler: [requireAuth, requirePermission('sales.order.reserve')] },
    async (r: any) => ({
      success: true,
      order: out(await f.orderService.reserve(ctx(r), requestParam(r.params, 'id') ?? '')),
    }),
  );
};
export default orderRoutes;
