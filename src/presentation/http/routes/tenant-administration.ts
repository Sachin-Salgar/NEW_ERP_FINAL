import type { FastifyPluginAsync } from 'fastify';
import { ValidationError, NotFoundError } from '../../../domain/errors.js';
import { requireAuth, requirePlatformPermission } from '../middleware/auth.js';
import { recordSecurityEvent } from '../security-audit.js';

const tenantAdministrationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/tenants/current', { preHandler: [requireAuth, requirePlatformPermission('tenant.read')] }, async (request) => {
    if (!request.tenantId) throw new ValidationError('Tenant context is required.');
    const tenant = await request.server.tenantAdministrationService.get(request.tenantId);
    if (!tenant) throw new NotFoundError('Tenant not found.');
    return { success: true, tenant };
  });
  fastify.patch<{ Body: { name?: string; displayName?: string | null; timezone?: string; currency?: string; locale?: string } }>('/tenants/current', { preHandler: [requireAuth, requirePlatformPermission('tenant.update')] }, async (request) => {
    if (!request.tenantId) throw new ValidationError('Tenant context is required.');
    const tenant = await request.server.tenantAdministrationService.update(request.tenantId, request.body);
    if (!tenant) throw new NotFoundError('Tenant not found.');
    await recordSecurityEvent(request, { tenantId: request.tenantId, actorUserId: request.user?.id, action: 'tenant.update', resourceType: 'tenant', resourceId: request.tenantId, outcome: 'success', metadata: {} });
    return { success: true, tenant };
  });
  for (const [path, permission, status] of [['suspend', 'tenant.suspend', 'suspended'], ['reactivate', 'tenant.reactivate', 'active'], ['deactivate', 'tenant.deactivate', 'suspended']] as const) {
    fastify.post(`/tenants/current/${path}`, { preHandler: [requireAuth, requirePlatformPermission(permission)] }, async (request) => {
      if (!request.tenantId) throw new ValidationError('Tenant context is required.');
      const tenant = await request.server.tenantAdministrationService.transition(request.tenantId, status);
      if (!tenant) throw new NotFoundError('Tenant not found.');
      await recordSecurityEvent(request, { tenantId: request.tenantId, actorUserId: request.user?.id, action: permission, resourceType: 'tenant', resourceId: request.tenantId, outcome: 'success', metadata: { status } });
      return { success: true, tenant };
    });
  }
};
export default tenantAdministrationRoutes;
