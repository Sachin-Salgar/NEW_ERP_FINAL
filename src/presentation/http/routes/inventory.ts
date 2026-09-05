import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { parsePaginationQuery } from '../pagination.js';
import { requestParam } from '../request-input.js';
import { ValidationError } from '../../../domain/errors.js';

function context(request: FastifyRequest) {
  if (!request.user?.organizationId || !request.tenantId || !request.user.branchId || !request.user.financialYearId) {
    throw new ValidationError('Authenticated organization, branch, and financial-year context is required.');
  }
  return {
    tenantId: request.tenantId,
    organizationId: request.user.organizationId,
    branchId: request.user.branchId,
    financialYearId: request.user.financialYearId,
    userId: request.user.id,
  };
}

const inventoryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/inventory/warehouses', { preHandler: [requireAuth, requirePermission('inventory.warehouse.create')] }, async (request, reply) => {
    const warehouse = await fastify.inventoryService.createWarehouse(context(request), request.body as { code: string; name: string });
    reply.code(201);
    return { success: true, warehouse };
  });
  fastify.get('/inventory/warehouses', { preHandler: [requireAuth, requirePermission('inventory.warehouse.read')] }, async (request) => {
    const pagination = parsePaginationQuery(request.query);
    const result = await fastify.inventoryService.listWarehouses(context(request), pagination);
    return { success: true, warehouses: result.items, metadata: { page: pagination.page, page_size: pagination.pageSize, total: result.total, total_pages: Math.ceil(result.total / pagination.pageSize) } };
  });
  fastify.patch('/inventory/warehouses/:id', { preHandler: [requireAuth, requirePermission('inventory.warehouse.update')] }, async (request) => ({
    success: true,
    warehouse: await fastify.inventoryService.updateWarehouse(
      context(request),
      requestParam(request.params, 'id') ?? '',
      request.body as { name: string; status: 'ACTIVE' | 'INACTIVE'; expectedVersion: number },
    ),
  }));
  fastify.get('/inventory/stock', { preHandler: [requireAuth, requirePermission('inventory.stock.read')] }, async (request) => {
    const pagination = parsePaginationQuery(request.query);
    const query = request.query as { warehouseId?: string; itemId?: string };
    const result = await fastify.inventoryService.listStock(context(request), { ...pagination, warehouseId: query.warehouseId, itemId: query.itemId });
    return { success: true, stock: result.items, metadata: { page: pagination.page, page_size: pagination.pageSize, total: result.total, total_pages: Math.ceil(result.total / pagination.pageSize) } };
  });
  fastify.post('/inventory/stock/receipts', { preHandler: [requireAuth, requirePermission('inventory.stock.receive')] }, async (request, reply) => {
    const stock = await fastify.inventoryService.receive(context(request), request.body as {
      warehouseId: string; itemId: string; quantity: number; sourceType: string; sourceId: string; operationKey: string;
    });
    reply.code(201);
    return { success: true, stock };
  });
  fastify.get('/inventory/reservations', { preHandler: [requireAuth, requirePermission('inventory.reservation.read')] }, async (request) => {
    const pagination = parsePaginationQuery(request.query);
    const query = request.query as { status?: 'RESERVED' | 'RELEASED' | 'FULFILLED' };
    const result = await fastify.inventoryService.listReservations(context(request), { ...pagination, status: query.status });
    return { success: true, reservations: result.items, metadata: { page: pagination.page, page_size: pagination.pageSize, total: result.total, total_pages: Math.ceil(result.total / pagination.pageSize) } };
  });
  fastify.post('/inventory/reservations', { preHandler: [requireAuth, requirePermission('inventory.reservation.create')] }, async (request, reply) => {
    const reservation = await fastify.inventoryService.reserve(context(request), request.body as {
      warehouseId: string; itemId: string; quantity: number; sourceType: string; sourceId: string; idempotencyKey: string;
    });
    reply.code(201);
    return { success: true, reservation };
  });
  fastify.post('/inventory/reservations/:id/release', { preHandler: [requireAuth, requirePermission('inventory.reservation.release')] }, async (request) => ({
    success: true,
    reservation: await fastify.inventoryService.release(context(request), requestParam(request.params, 'id') ?? '', (request.body as { idempotencyKey: string }).idempotencyKey),
  }));
  fastify.post('/inventory/reservations/:id/fulfill', { preHandler: [requireAuth, requirePermission('inventory.reservation.fulfill')] }, async (request) => ({
    success: true,
    reservation: await fastify.inventoryService.fulfill(context(request), requestParam(request.params, 'id') ?? '', (request.body as { idempotencyKey: string }).idempotencyKey),
  }));
  fastify.post('/inventory/stock/returns', { preHandler: [requireAuth, requirePermission('inventory.stock.return')] }, async (request, reply) => {
    const movement = await fastify.inventoryService.returnStock(context(request), request.body as {
      warehouseId: string; itemId: string; quantity: number; sourceType: string; sourceId: string; idempotencyKey: string;
    });
    reply.code(201);
    return { success: true, movement };
  });
};

export default inventoryRoutes;
