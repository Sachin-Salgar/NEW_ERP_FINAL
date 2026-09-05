import type { FastifyPluginAsync } from 'fastify';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { parsePaginationQuery } from '../pagination.js';
import { ForbiddenError } from '../../../domain/errors.js';

const routes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/sales/reports/document-summary', {
    preHandler: [requireAuth, requirePermission('sales.reporting.read')],
  }, async (request) => {
    const user = request.user;
    if (!user?.organizationId || !user.branchId || !user.financialYearId) {
      throw new ForbiddenError('An active organization, branch, and financial year are required.');
    }
    const page = parsePaginationQuery(request.query);
    const result = await fastify.salesReportingService.listDocumentSummary({
      tenantId: request.tenantId!,
      organizationId: user.organizationId,
      branchId: user.branchId,
      financialYearId: user.financialYearId,
      userId: user.id,
    }, page);
    return {
      success: true,
      documents: result.items,
      metadata: {
        page: page.page,
        page_size: page.pageSize,
        total: result.total,
        total_pages: Math.ceil(result.total / page.pageSize),
        order: page.order,
      },
    };
  });
};

export default routes;
