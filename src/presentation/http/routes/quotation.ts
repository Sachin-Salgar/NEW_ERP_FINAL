import type { FastifyPluginAsync } from 'fastify';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { parsePaginationQuery } from '../pagination.js';
import { requestParam } from '../request-input.js';
import type { QuotationRecord } from '../../../domain/contracts/repositories.js';
function ctx(r: any) {
  return {
    tenantId: r.tenantId,
    organizationId: r.user.organizationId,
    branchId: r.user.branchId ?? r.user.defaultBranchId,
    financialYearId: r.user.financialYearId,
    userId: r.user.id,
  };
}
function out(q: QuotationRecord) {
  const { tenantId: _tenantId, ...publicQuotation } = q;
  return {
    ...publicQuotation,
    quotationDate: q.quotationDate.toISOString().slice(0, 10),
    validUntil: q.validUntil.toISOString().slice(0, 10),
  };
}
const quotationRoutes: FastifyPluginAsync = async (f) => {
  f.post(
    '/sales/quotations',
    { preHandler: [requireAuth, requirePermission('sales.quotation.create')] },
    async (r: any, h) => {
      const q = await f.quotationService.create(ctx(r), r.body);
      h.code(201);
      return { success: true, quotation: out(q) };
    },
  );
  f.get(
    '/sales/quotations',
    { preHandler: [requireAuth, requirePermission('sales.quotation.read')] },
    async (r: any) => {
      const p = parsePaginationQuery(r.query);
      const x = await f.quotationService.list(ctx(r), { ...p });
      return {
        success: true,
        quotations: x.items.map(out),
        metadata: {
          page: p.page,
          page_size: p.pageSize,
          total: x.total,
          total_pages: Math.ceil(x.total / p.pageSize),
          order: p.order,
          ...(p.search ? { search: p.search } : {}),
        },
      };
    },
  );
  f.get(
    '/sales/quotations/:id',
    { preHandler: [requireAuth, requirePermission('sales.quotation.read')] },
    async (r: any) => ({
      success: true,
      quotation: out(await f.quotationService.get(ctx(r), requestParam(r.params, 'id') ?? '')),
    }),
  );
  f.patch(
    '/sales/quotations/:id',
    { preHandler: [requireAuth, requirePermission('sales.quotation.update')] },
    async (r: any) => ({
      success: true,
      quotation: out(await f.quotationService.update(ctx(r), requestParam(r.params, 'id') ?? '', r.body)),
    }),
  );
  f.delete(
    '/sales/quotations/:id',
    { preHandler: [requireAuth, requirePermission('sales.quotation.delete')] },
    async (r: any) => ({
      success: true,
      quotation: out(await f.quotationService.delete(ctx(r), requestParam(r.params, 'id') ?? '')),
    }),
  );
  for (const s of ['send', 'accept', 'reject', 'expire', 'cancel'] as const)
    f.post(
      `/sales/quotations/:id/${s}`,
      { preHandler: [requireAuth, requirePermission(`sales.quotation.${s}`)] },
      async (r: any) => ({
        success: true,
        quotation: out(
          await f.quotationService.transition(
            ctx(r),
            requestParam(r.params, 'id') ?? '',
            (s === 'send' ? 'SENT' : s === 'cancel' ? 'CANCELLED' : s.toUpperCase()) as any,
          ),
        ),
      }),
    );
};
export default quotationRoutes;
