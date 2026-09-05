import type { FastifyPluginAsync } from 'fastify';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const context = (request: any) => ({
  tenantId: request.tenantId,
  organizationId: request.user.organizationId,
  userId: request.user.id,
});

const routes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/sales/price-lists', {
    preHandler: [requireAuth, requirePermission('sales.pricing.create')],
  }, async (request: any, reply) => {
    reply.code(201);
    return { success: true, priceList: await fastify.pricingService.create(context(request), request.body) };
  });
  fastify.get('/sales/price-lists', {
    preHandler: [requireAuth, requirePermission('sales.pricing.read')],
  }, async (request: any) => ({ success: true, priceLists: await fastify.pricingService.list(context(request)) }));
  fastify.get('/sales/price-lists/:id', {
    preHandler: [requireAuth, requirePermission('sales.pricing.read')],
  }, async (request: any) => ({ success: true, priceList: await fastify.pricingService.get(context(request), request.params.id) }));
  fastify.post('/sales/price-lists/:id/items', {
    preHandler: [requireAuth, requirePermission('sales.pricing.update')],
  }, async (request: any, reply) => {
    reply.code(201);
    return { success: true, item: await fastify.pricingService.addItem(context(request), request.params.id, request.body) };
  });
  fastify.get('/sales/price-lists/resolve', {
    preHandler: [requireAuth, requirePermission('sales.pricing.read')],
  }, async (request: any) => {
    const branchId = request.user.branchId ?? request.user.defaultBranchId;
    return {
      success: true,
      price: await fastify.pricingService.resolvePrice(context(request), { ...request.query, branchId }),
    };
  });
  fastify.patch('/sales/price-lists/:id', {
    preHandler: [requireAuth, requirePermission('sales.pricing.update')],
  }, async (request: any) => ({ success: true, priceList: await fastify.pricingService.update(context(request), request.params.id, request.body) }));
  for (const status of ['publish', 'archive'] as const) {
    fastify.post(`/sales/price-lists/:id/${status}`, {
      preHandler: [requireAuth, requirePermission(`sales.pricing.${status}`)],
    }, async (request: any) => ({
      success: true,
      priceList: await fastify.pricingService.transition(
        context(request),
        request.params.id,
        status === 'publish' ? 'PUBLISHED' : 'ARCHIVED',
        request.body.expectedVersion,
      ),
    }));
  }
};

export default routes;
