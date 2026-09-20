import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { parsePaginationQuery } from '../pagination.js';
import { requestParam } from '../request-input.js';
import { ValidationError } from '../../../domain/errors.js';

const context = (request: FastifyRequest) => {
  if (!request.user?.tenantId || !request.tenantId || !request.user.branchId) throw new ValidationError('Authenticated tenant and branch context is required.');
  return { tenantId: request.tenantId, branchId: request.user.branchId, userId: request.user.id };
};

const manufacturingMachineRoutes: FastifyPluginAsync = async fastify => {
  fastify.post('/manufacturing/machines', { preHandler: [requireAuth, requirePermission('manufacturing.machine.create')] }, async (request, reply) => {
    const machine = await fastify.manufacturingMachineService.create(context(request), request.body as Record<string, unknown>);
    reply.code(201); return { success: true, machine };
  });
  fastify.get('/manufacturing/machines', { preHandler: [requireAuth, requirePermission('manufacturing.machine.read')] }, async request => {
    const pagination = parsePaginationQuery(request.query);
    const query = request.query as { search?: string; status?: 'ACTIVE'|'INACTIVE'|'MAINTENANCE' };
    const result = await fastify.manufacturingMachineService.list(context(request), { ...pagination, search: query.search, status: query.status });
    return { success: true, machines: result.items, metadata: { page: pagination.page, page_size: pagination.pageSize, total: result.total, total_pages: Math.ceil(result.total / pagination.pageSize) } };
  });
  fastify.get('/manufacturing/machines/:id', { preHandler: [requireAuth, requirePermission('manufacturing.machine.read')] }, async request => ({ success: true, machine: await fastify.manufacturingMachineService.get(context(request), requestParam(request.params, 'id') ?? '') }));
  fastify.patch('/manufacturing/machines/:id', { preHandler: [requireAuth, requirePermission('manufacturing.machine.update')] }, async request => ({ success: true, machine: await fastify.manufacturingMachineService.update(context(request), requestParam(request.params, 'id') ?? '', request.body as Record<string, unknown>) }));
  fastify.delete('/manufacturing/machines/:id', { preHandler: [requireAuth, requirePermission('manufacturing.machine.delete')] }, async request => ({ success: true, machine: await fastify.manufacturingMachineService.softDelete(context(request), requestParam(request.params, 'id') ?? '', Number((request.body as { expectedVersion?: number })?.expectedVersion)) }));
};

export default manufacturingMachineRoutes;
