import { type FastifyPluginAsync, type FastifyRequest } from 'fastify';

import { ValidationError } from '../../../domain/errors.js';
import type { CustomerRecord } from '../../../domain/contracts/repositories.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { requestParam } from '../request-input.js';
import { parsePaginationQuery } from '../pagination.js';

interface CustomerParams {
  id: string;
}

type CustomerBody = Record<string, unknown>;

function requireTenant(request: FastifyRequest) {
  const tenantId = request.tenantId;
  if (!request.user) throw new ValidationError('Authentication is required.');
  if (!tenantId) throw new ValidationError('Tenant context is required.');
  return { tenantId, userId: request.user.id };
}

function customerResponse(customer: CustomerRecord) {
  return customer;
}

const customerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: CustomerBody }>(
    '/customers',
    { preHandler: [requireAuth, requirePermission('customer.create')] },
    async (request, reply) => {
      const context = requireTenant(request);
      const body = request.body;
      const customer = await request.server.customerService.create(context, body);
      reply.code(201);
      return { success: true, customer: customerResponse(customer) };
    },
  );

  fastify.get('/customers', { preHandler: [requireAuth, requirePermission('customer.read')] }, async (request) => {
    const context = requireTenant(request);
    const query = parsePaginationQuery(request.query);
    if (query.sort && query.sort !== 'name') {
      throw new ValidationError('Unsupported sort field: ' + query.sort + '.');
    }
    const result = await request.server.customerService.list(context, {
      page: query.page,
      pageSize: query.pageSize,
      order: query.order,
      search: query.search,
    });
    return {
      success: true,
      customers: result.items.map(customerResponse),
      metadata: {
        page: query.page,
        page_size: query.pageSize,
        total: result.total,
        total_pages: Math.ceil(result.total / query.pageSize),
        ...(query.sort ? { sort: query.sort } : {}),
        order: query.order,
        ...(query.search ? { search: query.search } : {}),
      },
    };
  });

  fastify.get<{ Params: CustomerParams }>(
    '/customers/:id',
    { preHandler: [requireAuth, requirePermission('customer.read')] },
    async (request) => {
      const context = requireTenant(request);
      const customerId = requestParam(request.params, 'id') ?? '';
      const customer = await request.server.customerService.get(context, customerId);
      return { success: true, customer: customerResponse(customer) };
    },
  );

  fastify.patch<{ Params: CustomerParams; Body: CustomerBody }>(
    '/customers/:id',
    { preHandler: [requireAuth, requirePermission('customer.update')] },
    async (request) => {
      const context = requireTenant(request);
      const customerId = requestParam(request.params, 'id') ?? '';
      const customer = await request.server.customerService.update(context, customerId, request.body);
      return { success: true, customer: customerResponse(customer) };
    },
  );

  fastify.delete<{ Params: CustomerParams }>(
    '/customers/:id',
    { preHandler: [requireAuth, requirePermission('customer.delete')] },
    async (request) => {
      const context = requireTenant(request);
      const customerId = requestParam(request.params, 'id') ?? '';
      await request.server.customerService.softDelete(context, customerId, typeof request.query === 'object' && request.query !== null && 'expectedVersion' in request.query
        ? Number((request.query as Record<string, unknown>).expectedVersion)
        : undefined);
      return { success: true, deleted: true };
    },
  );
};

export default customerRoutes;
