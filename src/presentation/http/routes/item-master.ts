import { type FastifyPluginAsync, type FastifyRequest } from 'fastify';

import { requireAuth, requirePermission } from '../middleware/auth.js';
import { parsePaginationQuery } from '../pagination.js';
import { requestParam } from '../request-input.js';
import { ForbiddenError, ValidationError } from '../../../domain/errors.js';
import type { ItemRecord } from '../../../domain/contracts/repositories.js';

interface ItemParams { id: string }
interface CreateItemBody { organizationId: string; code: string; name: string; description?: string | null; unitOfMeasure: string; salesEligible?: boolean }
interface UpdateItemBody { name: string; description?: string | null; unitOfMeasure: string; salesEligible: boolean; expectedVersion: number }

function context(request: FastifyRequest) {
  if (!request.user || !request.tenantId || !request.user.organizationId) throw new ValidationError('Authenticated organization context is required.');
  return { tenantId: request.tenantId, organizationId: request.user.organizationId, userId: request.user.id };
}

function response(item: ItemRecord) {
  return { id: item.id, organizationId: item.organizationId, code: item.code, name: item.name, description: item.description,
    unitOfMeasure: item.unitOfMeasure, salesEligible: item.salesEligible, status: item.status, version: item.version,
    createdAt: item.createdAt, updatedAt: item.updatedAt };
}

const itemMasterRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: CreateItemBody }>('/inventory/items', { preHandler: [requireAuth, requirePermission('inventory.item.create')] }, async (request, reply) => {
    const ctx = context(request);
    if (request.body.organizationId !== ctx.organizationId) throw new ForbiddenError('Item organization must match the active organization.');
    const item = await request.server.itemMasterService.create(ctx, request.body);
    reply.code(201);
    return { success: true, item: response(item) };
  });

  fastify.get('/inventory/items', { preHandler: [requireAuth, requirePermission('inventory.item.read')] }, async (request) => {
    const ctx = context(request);
    const query = parsePaginationQuery(request.query);
    if (query.sort && query.sort !== 'name') throw new ValidationError('Unsupported sort field: ' + query.sort + '.');
    const result = await request.server.itemMasterService.list(ctx, { page: query.page, pageSize: query.pageSize, order: query.order, search: query.search });
    return { success: true, items: result.items.map(response), metadata: { page: query.page, page_size: query.pageSize, total: result.total, total_pages: Math.ceil(result.total / query.pageSize), order: query.order, ...(query.search ? { search: query.search } : {}) } };
  });

  fastify.get<{ Params: ItemParams }>('/inventory/items/:id', { preHandler: [requireAuth, requirePermission('inventory.item.read')] }, async (request) => {
    return { success: true, item: response(await request.server.itemMasterService.get(context(request), requestParam(request.params, 'id') ?? '')) };
  });

  fastify.patch<{ Params: ItemParams; Body: UpdateItemBody }>('/inventory/items/:id', { preHandler: [requireAuth, requirePermission('inventory.item.update')] }, async (request) => {
    return { success: true, item: response(await request.server.itemMasterService.update(context(request), requestParam(request.params, 'id') ?? '', request.body)) };
  });

  fastify.delete<{ Params: ItemParams; Body: { expectedVersion: number } }>('/inventory/items/:id', { preHandler: [requireAuth, requirePermission('inventory.item.delete')] }, async (request) => {
    return { success: true, item: response(await request.server.itemMasterService.softDelete(context(request), requestParam(request.params, 'id') ?? '', request.body.expectedVersion)) };
  });
};

export default itemMasterRoutes;
