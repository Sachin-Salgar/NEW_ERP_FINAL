import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { requireAuth, requirePermission, requirePlatformContext } from '../middleware/auth.js';
import { parsePaginationQuery } from '../pagination.js';
import { requestParam } from '../request-input.js';
import { ValidationError } from '../../../domain/errors.js';

function context(request: FastifyRequest) {
  if (!request.tenantId || !request.user?.branchId || !request.user.financialYearId)
    throw new ValidationError('Authenticated tenant, branch, and financial-year context is required.');
  return { tenantId: request.tenantId, branchId: request.user.branchId, financialYearId: request.user.financialYearId, userId: request.user.id };
}

const workflowRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/platform/workflows', { preHandler: requirePlatformContext('workflow.configuration.manage') }, async (request, reply) => {
    const body = request.body as Record<string, any>;
    if (!body.tenantId || !body.branchId) throw new ValidationError('Tenant and branch are required.');
    const result = await fastify.workflowService.createDefinition(
      { tenantId: body.tenantId, branchId: body.branchId, financialYearId: body.financialYearId ?? body.branchId, userId: request.identityId ?? '' },
      {
        documentType: String(body.documentType ?? 'PURCHASE_ORDER'),
        name: String(body.name ?? ''),
        approvalRequired: Boolean(body.approvalRequired),
        allowCorrection: Boolean(body.allowCorrection),
        allowDelegation: Boolean(body.allowDelegation),
        escalationAfterMinutes: body.escalationAfterMinutes ?? null,
        levels: Array.isArray(body.levels) ? body.levels : [],
      },
    );
    return reply.code(201).send({ success: true, workflow: result });
  });
  fastify.post('/platform/workflows/:versionId/validate', { preHandler: requirePlatformContext('workflow.configuration.manage') }, async (request) => {
    const body = request.body as Record<string, any>;
    return { success: true, workflow: await fastify.workflowService.validateDefinition(
      { tenantId: String(body.tenantId), branchId: String(body.branchId), financialYearId: String(body.financialYearId ?? body.branchId), userId: request.identityId ?? '' },
      requestParam(request.params, 'versionId') ?? '',
    ) };
  });
  fastify.post('/platform/workflows/:versionId/activate', { preHandler: requirePlatformContext('workflow.configuration.manage') }, async (request) => {
    const body = request.body as Record<string, any>;
    return { success: true, workflow: await fastify.workflowService.activateDefinition(
      { tenantId: String(body.tenantId), branchId: String(body.branchId), financialYearId: String(body.financialYearId ?? body.branchId), userId: request.identityId ?? '' },
      requestParam(request.params, 'versionId') ?? '',
    ) };
  });
  fastify.get('/workflow/definitions', { preHandler: [requireAuth, requirePermission('purchase.order.read')] }, async (request) => {
    const pagination = parsePaginationQuery(request.query);
    return { success: true, ...(await fastify.workflowService.listDefinitions(context(request), pagination.page, pagination.pageSize)) };
  });
  fastify.get('/workflow/instances', { preHandler: [requireAuth, requirePermission('purchase.order.read')] }, async (request) => {
    const query = request.query as { documentType?: string; documentId?: string };
    return { success: true, workflowInstances: await fastify.workflowService.listInstances(context(request), query.documentType, query.documentId) };
  });
  fastify.get('/workflow/instances/:id', { preHandler: [requireAuth, requirePermission('purchase.order.read')] }, async (request) => ({
    success: true,
    workflow: await fastify.workflowService.getInstance(context(request), requestParam(request.params, 'id') ?? ''),
  }));
  fastify.post('/workflow/instances/:id/tasks/:taskId/decision', { preHandler: [requireAuth, requirePermission('workflow.task.decide')] }, async (request) => {
    const body = request.body as Record<string, any>;
    const decision = String(body.decision ?? '').toUpperCase();
    if (!['APPROVE', 'REJECT', 'CORRECTION'].includes(decision)) throw new ValidationError('Invalid workflow decision.');
    return { success: true, result: await fastify.workflowService.decide(
      context(request),
      requestParam(request.params, 'id') ?? '',
      requestParam(request.params, 'taskId') ?? '',
      decision as 'APPROVE' | 'REJECT' | 'CORRECTION',
      Number(body.expectedVersion),
      String(body.operationKey ?? ''),
    ) };
  });
  fastify.post('/workflow/delegations', { preHandler: [requireAuth, requirePermission('workflow.task.decide')] }, async (request) => ({
    success: true,
    delegation: await fastify.workflowService.createDelegation(context(request), request.body as any),
  }));
  fastify.post('/workflow/delegations/:id/revoke', { preHandler: [requireAuth, requirePermission('workflow.task.decide')] }, async (request) => ({
    success: true,
    revoked: await fastify.workflowService.revokeDelegation(context(request), requestParam(request.params, 'id') ?? ''),
  }));
};

export default workflowRoutes;
