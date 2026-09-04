import { type FastifyPluginAsync, type FastifyRequest } from 'fastify';

import { NotFoundError, ValidationError } from '../../../domain/errors.js';
import { requireAuth, requirePermission, requirePermissionOrSelf } from '../middleware/auth.js';
import { requestParam } from '../request-input.js';
import { paginate, parsePaginationQuery } from '../pagination.js';

interface RoleIdParams {
  roleId: string;
}

interface UserIdParams {
  userId: string;
}

interface UserRoleParams extends UserIdParams, RoleIdParams {}

interface CreateRoleBody {
  code: string;
  name: string;
  description?: string | null;
  isSystem?: boolean;
  sortOrder?: number;
}

type UpdateRoleBody = Partial<CreateRoleBody>;

interface PermissionAssignmentBody {
  permissionKeys?: string[] | string;
  permissionKey?: string;
  permissions?: string[] | string;
}

interface AssignRoleBody {
  roleId: string;
}

const getTenantIdFromRequest = (request: FastifyRequest): string | null => request.tenantId ?? null;

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
  fastify.post<{ Body: CreateRoleBody }>('/rbac/roles', { preHandler: [requireAuth, requirePermission('role.manage')] }, async (request) => {
    const body = request.body;
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const code = body.code?.trim() ?? '';
    const name = body.name?.trim() ?? '';
    const description = typeof body.description === 'string' ? body.description.trim() : null;

    if (!code || !name) {
      throw new ValidationError('Role code and name are required.');
    }

    const role = await request.server.authorizationService.createRole(tenantId, { code, name, description, isSystem: Boolean(body.isSystem) });
    return { success: true, role };
  });

  fastify.get('/rbac/roles', { preHandler: [requireAuth, requirePermission('role.read')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const query = parsePaginationQuery(request.query);
    const roles = await request.server.authorizationService.listRoles(tenantId);
    const result = paginate(roles, query, {
      searchable: [
        (role) => role.code,
        (role) => role.name,
        (role) => role.description,
      ],
      sortable: {
        code: (role) => role.code,
        name: (role) => role.name,
        sortOrder: (role) => role.sortOrder,
        createdAt: (role) => role.createdAt,
      },
    });
    return { success: true, roles: result.data, metadata: result.metadata };
  });

  fastify.get<{ Params: RoleIdParams }>('/rbac/roles/:roleId', { preHandler: [requireAuth, requirePermission('role.read')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const roleId = request.params.roleId.trim();
    const role = await request.server.authorizationService.getRole(tenantId, roleId);
    if (!role) {
      throw new NotFoundError('Role not found.');
    }

    return { success: true, role };
  });

  fastify.patch<{ Params: RoleIdParams; Body: UpdateRoleBody }>('/rbac/roles/:roleId', { preHandler: [requireAuth, requirePermission('role.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const body = request.body;
    const roleId = request.params.roleId.trim();

    const updated = await request.server.authorizationService.updateRole(tenantId, roleId, {
      code: typeof body.code === 'string' ? body.code.trim() : undefined,
      name: typeof body.name === 'string' ? body.name.trim() : undefined,
      description: typeof body.description === 'string' ? body.description.trim() : body.description === null ? null : undefined,
      isSystem: typeof body.isSystem === 'boolean' ? body.isSystem : undefined,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
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

    const query = parsePaginationQuery(request.query);
    const permissions = await request.server.authorizationService.listPermissions(tenantId);
    const result = paginate(permissions, query, {
      searchable: [
        (permission) => permission.permissionKey,
        (permission) => permission.displayName,
        (permission) => permission.moduleCode,
        (permission) => permission.resource,
        (permission) => permission.action,
      ],
      sortable: {
        permissionKey: (permission) => permission.permissionKey,
        displayName: (permission) => permission.displayName,
        moduleCode: (permission) => permission.moduleCode,
        resource: (permission) => permission.resource,
        action: (permission) => permission.action,
      },
    });
    return { success: true, permissions: result.data, metadata: result.metadata };
  });

  fastify.put<{ Params: RoleIdParams; Body: PermissionAssignmentBody }>('/rbac/roles/:roleId/permissions', { preHandler: [requireAuth, requirePermission('role.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const body = request.body;
    const roleId = request.params.roleId.trim();
    const permissionKeys = normalizePermissionKeys(body.permissionKeys ?? body.permissionKey ?? body.permissions);

    const role = await request.server.authorizationService.getRole(tenantId, roleId);
    if (!role) {
      throw new NotFoundError('Role not found.');
    }

    const count = await request.server.authorizationService.replacePermissionsForRole(tenantId, roleId, permissionKeys);
    return { success: true, replaced: count };
  });

  fastify.post<{ Params: RoleIdParams; Body: PermissionAssignmentBody }>('/rbac/roles/:roleId/permissions', { preHandler: [requireAuth, requirePermission('role.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const body = request.body;
    const roleId = request.params.roleId.trim();
    const permissionKeys = normalizePermissionKeys(body.permissionKeys ?? body.permissionKey ?? body.permissions);

    if (permissionKeys.length === 0) {
      throw new ValidationError('At least one permission key is required.');
    }

    const count = await request.server.authorizationService.assignPermissionsToRole(tenantId, roleId, permissionKeys);
    return { success: true, assigned: count };
  });

  fastify.delete<{ Params: RoleIdParams; Body: PermissionAssignmentBody }>('/rbac/roles/:roleId/permissions', { preHandler: [requireAuth, requirePermission('role.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const body = request.body;
    const roleId = request.params.roleId.trim();
    const permissionKeys = normalizePermissionKeys(body.permissionKeys ?? body.permissionKey ?? body.permissions);

    if (permissionKeys.length === 0) {
      throw new ValidationError('At least one permission key is required.');
    }

    const count = await request.server.authorizationService.removePermissionsFromRole(tenantId, roleId, permissionKeys);
    return { success: true, removed: count };
  });

  fastify.get<{ Params: RoleIdParams }>('/rbac/roles/:roleId/permissions', { preHandler: [requireAuth, requirePermission('role.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const roleId = request.params.roleId.trim();
    const permissions = await request.server.authorizationService.getPermissionsForRole(tenantId, roleId);
    return { success: true, permissions };
  });

  fastify.post<{ Params: UserIdParams; Body: AssignRoleBody }>('/rbac/users/:userId/roles', { preHandler: [requireAuth, requirePermission('user.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const userId = request.params.userId.trim();
    const roleId = request.body.roleId?.trim() ?? '';

    if (!roleId) {
      throw new ValidationError('Role ID is required.');
    }

    const assigned = await request.server.authorizationService.assignRoleToUser(tenantId, userId, roleId);
    return { success: true, assigned };
  });

  fastify.delete<{ Params: UserRoleParams }>('/rbac/users/:userId/roles/:roleId', { preHandler: [requireAuth, requirePermission('user.manage')] }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const userId = request.params.userId.trim();
    const roleId = request.params.roleId.trim();

    const revoked = await request.server.authorizationService.revokeRoleFromUser(tenantId, userId, roleId);
    return { success: true, revoked };
  });

  fastify.get<{ Params: UserIdParams }>('/rbac/users/:userId/roles', {
    preHandler: [
      requireAuth,
      requirePermissionOrSelf('user.read', (request) => requestParam(request.params, 'userId') ?? ''),
    ],
  }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const userId = request.params.userId.trim();
    const roles = await request.server.authorizationService.getRolesForUser(tenantId, userId);
    return { success: true, userId, roles };
  });

  fastify.get<{ Params: UserIdParams }>('/rbac/users/:userId/effective-permissions', {
    preHandler: [
      requireAuth,
      requirePermissionOrSelf('user.read', (request) => requestParam(request.params, 'userId') ?? ''),
    ],
  }, async (request) => {
    const tenantId = request.tenantId ?? getTenantIdFromRequest(request);
    if (!tenantId) {
      throw new ValidationError('Tenant context is required.');
    }

    const userId = request.params.userId.trim();
    const permissions = await request.server.authorizationService.getEffectivePermissions(tenantId, userId);
    return { success: true, userId, permissions };
  });

  fastify.get('/rbac/test/branch-read-check', { preHandler: [requireAuth, requirePermission('branch.read')] }, async () => ({
    success: true,
    message: 'branch.read granted',
  }));
};

export default rbacRoutes;
