import { type FastifyPluginAsync } from 'fastify';

import { NotFoundError, ValidationError } from '../../../domain/errors.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

interface BranchIdParams {
  id: string;
}

const branchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/branches', { preHandler: [requireAuth, requirePermission('organization.read')] }, async (request) => {
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
    { preHandler: [requireAuth, requirePermission('organization.read')] },
    async (request, reply) => {
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

      const result = await request.server.authService.createSessionForUser(
        request.tenantId,
        request.user.id,
        organizationId,
        request.user.activeLocationId ?? request.user.defaultLocationId ?? null,
        branch.id,
      );
      if (!result.success || !result.user || !result.session || !result.accessToken || !result.refreshToken) {
        throw new ValidationError('Unable to establish the selected active branch.');
      }

      reply.code(200);
      return {
        success: true,
        user: {
          id: result.user.id,
          tenantId: result.user.tenantId,
          organizationId: result.user.organizationId ?? organizationId,
          activeLocationId:
            result.user.activeLocationId ?? request.user.activeLocationId ?? request.user.defaultLocationId ?? null,
          defaultLocationId: result.user.defaultLocationId ?? request.user.defaultLocationId ?? null,
          defaultBranchId: result.user.defaultBranchId ?? branch.id,
          username: result.user.username,
          email: result.user.email,
          status: result.user.status,
        },
        session: {
          id: result.session.id,
          tenantId: result.session.tenantId,
          userId: result.session.userId,
          organizationId: result.session.organizationId ?? organizationId,
          locationId:
            result.session.locationId ?? request.user.activeLocationId ?? request.user.defaultLocationId ?? null,
          branchId: result.session.branchId ?? branch.id,
          isActive: result.session.isActive,
          expiresAt: result.session.expiresAt,
          loginAt: result.session.loginAt,
        },
        branch,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.session.expiresAt,
        tokenType: 'bearer',
      };
    },
  );
};

export default branchRoutes;
