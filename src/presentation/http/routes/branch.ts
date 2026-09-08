import { type FastifyPluginAsync } from 'fastify';

import { NotFoundError, ValidationError } from '../../../domain/errors.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

interface BranchIdParams {
  id: string;
}

const branchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/branches', { preHandler: [requireAuth, requirePermission('branch.read')] }, async (request) => {
    if (!request.tenantId || !request.user) throw new ValidationError('Authenticated tenant context is required.');
    const organizationId = request.user.organizationId ?? null;
    if (!organizationId) throw new ValidationError('An active organization is required before resolving branches.');
    const branches = await request.server.branchService.listAccessibleBranchesForUser(
      request.tenantId,
      request.user.id,
      organizationId,
    );
    return { success: true, branches };
  });

  fastify.post<{ Params: BranchIdParams }>(
    '/branches/:id/select',
    { preHandler: [requireAuth, requirePermission('branch.read')] },
    async (request) => {
      if (!request.tenantId || !request.user) throw new ValidationError('Authenticated tenant context is required.');
      const organizationId = request.user.organizationId ?? null;
      if (!organizationId) throw new ValidationError('An active organization is required before selecting a branch.');
      const branchId = request.params.id.trim();
      if (!branchId) throw new ValidationError('Branch ID is required.');

      const branch = await request.server.branchService.getAccessibleBranchByIdForUser(
        request.tenantId,
        request.user.id,
        branchId,
        organizationId,
      );
      if (!branch) throw new NotFoundError('Branch not found or access denied.');

      return { success: true, branch };
    },
  );
};

export default branchRoutes;
