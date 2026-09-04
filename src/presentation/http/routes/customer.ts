import { type FastifyPluginAsync, type FastifyRequest } from 'fastify';

import { NotFoundError, ValidationError, ForbiddenError } from '../../../domain/errors.js';
import type { CustomerRecord } from '../../../domain/contracts/repositories.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { requestParam } from '../request-input.js';
import { parsePaginationQuery } from '../pagination.js';

interface CustomerParams {
  id: string;
}

interface CreateCustomerBody {
  organizationId: string;
  name: string;
}

interface UpdateCustomerBody {
  name: string;
}

function requireTenantAndOrganization(request: FastifyRequest) {
  const tenantId = request.tenantId;
  if (!request.user) throw new ValidationError('Authentication is required.');
  const organizationId = request.user?.organizationId;
  if (!tenantId) throw new ValidationError('Tenant context is required.');
  if (!organizationId) throw new ValidationError('An active organization is required.');
  return { tenantId, organizationId, userId: request.user.id };
}

function customerResponse(customer: CustomerRecord) {
  return {
    id: customer.id,
    organizationId: customer.organizationId,
    name: customer.name,
    createdAt: customer.createdAt,
    createdBy: customer.createdBy,
    updatedAt: customer.updatedAt,
    updatedBy: customer.updatedBy,
    deletedAt: customer.deletedAt,
    deletedBy: customer.deletedBy,
    isDeleted: customer.isDeleted,
    version: customer.version,
  };
}

const customerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: CreateCustomerBody }>(
    '/customers',
    { preHandler: [requireAuth, requirePermission('customer.create')] },
    async (request, reply) => {
      const context = requireTenantAndOrganization(request);
      const body = request.body;
      if (body.organizationId !== context.organizationId) {
        throw new ForbiddenError('Customer organization must match the active organization.');
      }

      const organization = await request.server.coreEnterpriseService.getOrganization(
        context.tenantId,
        body.organizationId,
      );
      if (!organization) throw new NotFoundError('Organization not found.');

      const customer = await request.server.customerService.create(context, { name: body.name });
      reply.code(201);
      return { success: true, customer: customerResponse(customer) };
    },
  );

  fastify.get('/customers', { preHandler: [requireAuth, requirePermission('customer.read')] }, async (request) => {
    const context = requireTenantAndOrganization(request);
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
      const context = requireTenantAndOrganization(request);
      const customerId = requestParam(request.params, 'id') ?? '';
      const customer = await request.server.customerService.get(context, customerId);
      return { success: true, customer: customerResponse(customer) };
    },
  );

  fastify.patch<{ Params: CustomerParams; Body: UpdateCustomerBody }>(
    '/customers/:id',
    { preHandler: [requireAuth, requirePermission('customer.update')] },
    async (request) => {
      const context = requireTenantAndOrganization(request);
      const customerId = requestParam(request.params, 'id') ?? '';
      const customer = await request.server.customerService.update(context, customerId, {
        name: request.body.name,
      });
      return { success: true, customer: customerResponse(customer) };
    },
  );

  fastify.delete<{ Params: CustomerParams }>(
    '/customers/:id',
    { preHandler: [requireAuth, requirePermission('customer.delete')] },
    async (request) => {
      const context = requireTenantAndOrganization(request);
      const customerId = requestParam(request.params, 'id') ?? '';
      await request.server.customerService.softDelete(context, customerId);
      return { success: true, deleted: true };
    },
  );
};

export default customerRoutes;
