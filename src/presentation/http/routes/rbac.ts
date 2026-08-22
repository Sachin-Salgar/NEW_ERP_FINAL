import { type FastifyPluginAsync, type FastifyRequest } from 'fastify';

import { NotFoundError, ValidationError } from '../../../domain/errors.js';
import { requireAuth, requirePermission, requirePermissionOrSelf } from '../middleware/auth.js';

const getTenantIdFromRequest = (request: FastifyRequest): string | null => {
  const config = request.server.appConfig;
  const headerName = config.TENANT_HEADER.toLowerCase();
  const headerValue = request.headers[headerName];
  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim();
  }

  const body = request.body as Record<string, unknown> | undefined;
  const bodyTenantId = typeof body?.tenantId === 'string' ? body.tenantId.trim() : null;
  return bodyTenantId || null;
};

const normalizePermissionKeys = (input: unknown): string[] => {
  if (Array.isArray(input)) {
    return input.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean);
  }

  if (typeof input === 'string') {
    return input.split(',').map((value) => value.trim()).filter(Boolean);
  }

  return [];
};

const rbacRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/rbac/roles', { preHandler: [requireAuth, requirePermission('role.manage')] }, async (request) => {
    const body = request.body as Record<string, unknown> | undefined;
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : null;

    if (!code || !name) {
      throw new ValidationError('Role code and name are required.');
    }

    const role = await request.server.authorizationService.createRole(tenantId, { code, name, description, isSystem: Boolean(body?.isSystem) });
    return { success: true, role };
  });

  fastify.get('/rbac/roles', { preHandler: [requireAuth, requirePermission('role.read')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const roles = await request.server.authorizationService.listRoles(tenantId);
    return { success: true, roles };
  });

  fastify.get('/rbac/roles/:roleId', { preHandler: [requireAuth, requirePermission('role.read')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const roleId = String((request.params as { roleId?: string }).roleId ?? '');
    const role = await request.server.authorizationService.getRole(tenantId, roleId);
    if (!role) {
      throw new NotFoundError('Role not found.');
    }

    return { success: true, role };
  });

  fastify.patch('/rbac/roles/:roleId', { preHandler: [requireAuth, requirePermission('role.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const body = request.body as Record<string, unknown> | undefined;
    const roleId = String((request.params as { roleId?: string }).roleId ?? '');

    const updated = await request.server.authorizationService.updateRole(tenantId, roleId, {
      code: typeof body?.code === 'string' ? body.code.trim() : undefined,
      name: typeof body?.name === 'string' ? body.name.trim() : undefined,
      description: typeof body?.description === 'string' ? body.description.trim() : body?.description === null ? null : undefined,
      isSystem: typeof body?.isSystem === 'boolean' ? body.isSystem : undefined,
      sortOrder: typeof body?.sortOrder === 'number' ? body.sortOrder : undefined,
    });

    if (!updated) {
      throw new NotFoundError('Role not found.');
    }

    return { success: true, role: updated };
  });

  fastify.get('/rbac/permissions', { preHandler: [requireAuth, requirePermission('permission.read')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const permissions = await request.server.authorizationService.listPermissions(tenantId);
    return { success: true, permissions };
  });

  fastify.post('/rbac/roles/:roleId/permissions', { preHandler: [requireAuth, requirePermission('role.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const body = request.body as Record<string, unknown> | undefined;
    const roleId = String((request.params as { roleId?: string }).roleId ?? '');
    const permissionKeys = normalizePermissionKeys(body?.permissionKeys ?? body?.permissionKey ?? body?.permissions);

    if (permissionKeys.length === 0) {
      throw new ValidationError('At least one permission key is required.');
    }

    const count = await request.server.authorizationService.assignPermissionsToRole(tenantId, roleId, permissionKeys);
    return { success: true, assigned: count };
  });

  fastify.delete('/rbac/roles/:roleId/permissions', { preHandler: [requireAuth, requirePermission('role.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const body = request.body as Record<string, unknown> | undefined;
    const roleId = String((request.params as { roleId?: string }).roleId ?? '');
    const permissionKeys = normalizePermissionKeys(body?.permissionKeys ?? body?.permissionKey ?? body?.permissions);

    if (permissionKeys.length === 0) {
      throw new ValidationError('At least one permission key is required.');
    }

    const count = await request.server.authorizationService.removePermissionsFromRole(tenantId, roleId, permissionKeys);
    return { success: true, removed: count };
  });

  // New endpoint: list permissions assigned to a role
  fastify.get('/rbac/roles/:roleId/permissions', { preHandler: [requireAuth, requirePermission('role.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const roleId = String((request.params as { roleId?: string }).roleId ?? '');
    const permissions = await request.server.authorizationService.getPermissionsForRole(tenantId, roleId);
    return { success: true, permissions };
  });

  fastify.post('/rbac/users/:userId/roles', { preHandler: [requireAuth, requirePermission('user.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const body = request.body as Record<string, unknown> | undefined;
    const userId = String((request.params as { userId?: string }).userId ?? '');
    const roleId = typeof body?.roleId === 'string' ? body.roleId.trim() : '';

    if (!roleId) {
      throw new ValidationError('Role ID is required.');
    }

    const assigned = await request.server.authorizationService.assignRoleToUser(tenantId, userId, roleId);
    return { success: true, assigned };
  });

  fastify.delete('/rbac/users/:userId/roles/:roleId', { preHandler: [requireAuth, requirePermission('user.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const userId = String((request.params as { userId?: string }).userId ?? '');
    const roleId = String((request.params as { roleId?: string }).roleId ?? '');

    const revoked = await request.server.authorizationService.revokeRoleFromUser(tenantId, userId, roleId);
    return { success: true, revoked };
  });

  fastify.get('/rbac/users/:userId/effective-permissions', {
    preHandler: [
      requireAuth,
      requirePermissionOrSelf('user.read', (request) => String((request.params as { userId?: string }).userId ?? '')),
    ],
  }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const userId = String((request.params as { userId?: string }).userId ?? '');
    const permissions = await request.server.authorizationService.getEffectivePermissions(tenantId, userId);
    return { success: true, userId, permissions };
  });

  fastify.get('/rbac/test/branch-read-check', { preHandler: [requireAuth, requirePermission('branch.read')] }, async () => ({
    success: true,
    message: 'branch.read granted',
  }));
};

export default rbacRoutes;
