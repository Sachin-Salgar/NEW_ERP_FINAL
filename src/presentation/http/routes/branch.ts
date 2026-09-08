import { type FastifyPluginAsync } from 'fastify';

import { NotFoundError, ValidationError } from '../../../domain/errors.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

interface BranchIdParams {
  id: string;
}

const branchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/branches', { preHandler: [requireAuth, requirePermission('branch.read')] }, async (request) => {
    if (!request.tenantId || !request.user) throw new ValidationError('Authenticated tenant context is required.');
    const branches = await request.server.branchService.listTenantBranchesForUser(request.tenantId, request.user.id);
    return { success: true, branches };
  });

  fastify.get<{ Params: BranchIdParams }>(
    '/branches/:id',
    { preHandler: [requireAuth, requirePermission('branch.read')] },
    async (request) => {
      if (!request.tenantId || !request.user) throw new ValidationError('Authenticated tenant context is required.');
      const branchId = request.params.id.trim();
      if (!branchId) throw new ValidationError('Branch ID is required.');

      const branch = await request.server.branchService.getTenantBranchByIdForUser(
        request.tenantId,
        request.user.id,
        branchId,
      );
      if (!branch) throw new NotFoundError('Branch not found or access denied.');

      return { success: true, branch };
    },
  );
};

export default branchRoutes;
