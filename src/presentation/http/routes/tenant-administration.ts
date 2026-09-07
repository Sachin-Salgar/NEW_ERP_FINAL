import type { FastifyPluginAsync } from 'fastify';
import { ForbiddenError, ValidationError, NotFoundError } from '../../../domain/errors.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { recordSecurityEvent } from '../security-audit.js';

const tenantAdministrationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: {
      name: string;
      displayName?: string;
      subdomain: string;
      slug: string;
      administrator: { username: string; email: string; password: string };
      organization: { name: string };
      branch: { name: string };
      role?: { code?: string; name?: string };
    };
  }>('/tenants', { preHandler: [requireAuth, requirePermission('tenant.create')] }, async (request, reply) => {
    const body = request.body;
    if (!request.tenantId) throw new ValidationError('Platform tenant context is required.');
    const permissions = (await request.server.authorizationService.listPermissions(request.tenantId)).map(
      (permission) => permission.permissionKey,
    );
    const result = await request.server.tenantBootstrapService.bootstrapTenant({
      tenant: {
        name: body.name,
        displayName: body.displayName,
        subdomain: body.subdomain,
        slug: body.slug,
        status: 'active',
      },
      organization: { name: body.organization.name, isDefault: true },
      branch: { name: body.branch.name, isDefault: true, isHeadOffice: true },
      administrator: {
        username: body.administrator.username,
        email: body.administrator.email,
        password: body.administrator.password,
      },
      role: {
        code: body.role?.code ?? 'tenant_admin',
        name: body.role?.name ?? 'Tenant Administrator',
        isSystem: true,
      },
      permissions,
    });
    reply.code(201);
    return {
      success: true,
      tenantId: result.tenantId,
      organizationId: result.organizationId,
      branchId: result.branchId,
      userId: result.userId,
      roleId: result.roleId,
    };
  });
  fastify.get('/tenants/current', { preHandler: [requireAuth, requirePermission('tenant.read')] }, async (request) => {
    if (!request.tenantId) throw new ValidationError('Tenant context is required.');
    const tenant = await request.server.tenantAdministrationService.get(request.tenantId);
    if (!tenant) throw new NotFoundError('Tenant not found.');
    return { success: true, tenant };
  });
  fastify.patch<{
    Body: { name?: string; displayName?: string | null; timezone?: string; currency?: string; locale?: string };
  }>('/tenants/current', { preHandler: [requireAuth, requirePermission('tenant.update')] }, async (request) => {
    if (!request.tenantId) throw new ValidationError('Tenant context is required.');
    const tenant = await request.server.tenantAdministrationService.update(request.tenantId, request.body);
    if (!tenant) throw new NotFoundError('Tenant not found.');
    await recordSecurityEvent(request, {
      tenantId: request.tenantId,
      actorUserId: request.user?.id,
      action: 'tenant.update',
      resourceType: 'tenant',
      resourceId: request.tenantId,
      outcome: 'success',
      metadata: {},
    });
    return { success: true, tenant };
  });
  for (const [path, permission] of [
    ['suspend', 'tenant.suspend'],
    ['reactivate', 'tenant.reactivate'],
    ['deactivate', 'tenant.deactivate'],
    ['activate', 'tenant.activate'],
  ] as const) {
    fastify.post(
      `/tenants/current/${path}`,
      { preHandler: [requireAuth, requirePermission(permission)] },
      async (request) => {
        if (!request.tenantId) throw new ValidationError('Tenant context is required.');
        const tenant = await request.server.tenantAdministrationService.transition(request.tenantId, path);
        if (!tenant) throw new NotFoundError('Tenant not found.');
        await recordSecurityEvent(request, {
          tenantId: request.tenantId,
          actorUserId: request.user?.id,
          action: permission,
          resourceType: 'tenant',
          resourceId: request.tenantId,
          outcome: 'success',
          metadata: { status: tenant.status },
        });
        return { success: true, tenant };
      },
    );
  }
  fastify.delete(
    '/tenants/current',
    { preHandler: [requireAuth, requirePermission('tenant.delete')] },
    async (request) => {
      if (!request.tenantId) throw new ValidationError('Tenant context is required.');
      const tenant = await request.server.tenantAdministrationService.delete(request.tenantId);
      if (!tenant) throw new NotFoundError('Tenant not found.');
      await recordSecurityEvent(request, {
        tenantId: request.tenantId,
        actorUserId: request.user?.id,
        action: 'tenant.delete',
        resourceType: 'tenant',
        resourceId: request.tenantId,
        outcome: 'success',
        metadata: {},
      });
      return { success: true, deleted: true };
    },
  );
  fastify.get(
    '/tenants/current/members',
    { preHandler: [requireAuth, requirePermission('tenant.member.read')] },
    async (request) => {
      if (!request.tenantId) throw new ValidationError('Tenant context is required.');
      return { success: true, members: await request.server.coreEnterpriseService.listUsers(request.tenantId) };
    },
  );
  fastify.post<{
    Body: {
      username: string;
      email: string;
      password: string;
      organizationId?: string;
      defaultBranchId?: string;
      defaultLocationId?: string;
      roleCode?: string;
    };
  }>(
    '/tenants/current/members',
    { preHandler: [requireAuth, requirePermission('tenant.member.create')] },
    async (request, reply) => {
      if (!request.tenantId || !request.user) throw new ValidationError('Tenant context is required.');
      const body = request.body;
      const member = await request.server.registrationService.registerUser(request.tenantId, request.user.id, {
        username: body.username,
        email: body.email,
        password: body.password,
        organizationId: body.organizationId ?? request.user.organizationId ?? null,
        defaultBranchId: body.defaultBranchId ?? request.user.defaultBranchId ?? null,
        defaultLocationId: body.defaultLocationId ?? request.user.defaultLocationId ?? null,
        roleCode: body.roleCode ?? 'member',
      });
      await recordSecurityEvent(request, {
        tenantId: request.tenantId,
        actorUserId: request.user.id,
        action: 'tenant.member.create',
        resourceType: 'user',
        resourceId: member.id,
        outcome: 'success',
        metadata: { roleCode: body.roleCode ?? 'member' },
      });
      reply.code(201);
      return {
        success: true,
        member: {
          id: member.id,
          tenantId: member.tenantId,
          username: member.username,
          email: member.email,
          status: member.status,
        },
      };
    },
  );
  fastify.patch<{
    Params: { userId: string };
    Body: {
      username?: string;
      email?: string;
      organizationId?: string | null;
      defaultBranchId?: string | null;
      status?: string;
    };
  }>(
    '/tenants/current/members/:userId',
    { preHandler: [requireAuth, requirePermission('tenant.member.update')] },
    async (request) => {
      if (!request.tenantId) throw new ValidationError('Tenant context is required.');
      const member = await request.server.coreEnterpriseService.updateUser(
        request.tenantId,
        request.params.userId,
        request.body as never,
      );
      if (!member) throw new NotFoundError('Tenant member not found.');
      await recordSecurityEvent(request, {
        tenantId: request.tenantId,
        actorUserId: request.user?.id,
        action: 'tenant.member.update',
        resourceType: 'user',
        resourceId: request.params.userId,
        outcome: 'success',
        metadata: {},
      });
      return { success: true, member };
    },
  );
  for (const [path, permission, operation] of [
    ['activate', 'tenant.member.activate', 'activateUser'],
    ['deactivate', 'tenant.member.deactivate', 'deactivateUser'],
    ['delete', 'tenant.member.delete', 'deactivateUser'],
  ] as const) {
    fastify.post<{ Params: { userId: string } }>(
      `/tenants/current/members/:userId/${path}`,
      { preHandler: [requireAuth, requirePermission(permission)] },
      async (request) => {
        if (!request.tenantId) throw new ValidationError('Tenant context is required.');
        if (request.params.userId === request.user?.id)
          throw new ForbiddenError('An administrator cannot remove or deactivate their own membership.');
        const changed = await request.server.coreEnterpriseService[operation](request.tenantId, request.params.userId);
        if (!changed) throw new NotFoundError('Tenant member not found.');
        await recordSecurityEvent(request, {
          tenantId: request.tenantId,
          actorUserId: request.user?.id,
          action: permission,
          resourceType: 'user',
          resourceId: request.params.userId,
          outcome: 'success',
          metadata: {},
        });
        return { success: true, [path === 'delete' ? 'deleted' : `${path}d`]: true };
      },
    );
  }
  fastify.get<{ Params: { userId: string } }>(
    '/tenants/current/access/:userId',
    { preHandler: [requireAuth, requirePermission('tenant.access.read')] },
    async (request) => {
      if (!request.tenantId) throw new ValidationError('Tenant context is required.');
      return {
        success: true,
        access: await request.server.coreEnterpriseService.getUserAccess(request.tenantId, request.params.userId),
      };
    },
  );
  fastify.post<{ Params: { userId: string; organizationId: string } }>(
    '/tenants/current/access/:userId/organizations/:organizationId',
    { preHandler: [requireAuth, requirePermission('tenant.access.grant')] },
    async (request) => {
      if (!request.tenantId) throw new ValidationError('Tenant context is required.');
      if (request.params.userId === request.user?.id)
        throw new ForbiddenError('Users cannot grant themselves tenant access.');
      if (
        !(await request.server.coreEnterpriseService.assignUserToOrganization(
          request.tenantId,
          request.params.userId,
          request.params.organizationId,
        ))
      )
        throw new NotFoundError('User or organization not found.');
      await recordSecurityEvent(request, {
        tenantId: request.tenantId,
        actorUserId: request.user?.id,
        action: 'tenant.access.grant',
        resourceType: 'user_organization_access',
        resourceId: request.params.userId,
        outcome: 'success',
        metadata: { organizationId: request.params.organizationId },
      });
      return { success: true, granted: true };
    },
  );
  fastify.delete<{ Params: { userId: string; organizationId: string } }>(
    '/tenants/current/access/:userId/organizations/:organizationId',
    { preHandler: [requireAuth, requirePermission('tenant.access.revoke')] },
    async (request) => {
      if (!request.tenantId) throw new ValidationError('Tenant context is required.');
      if (request.params.userId === request.user?.id)
        throw new ForbiddenError('Users cannot revoke their own tenant access.');
      if (
        !(await request.server.coreEnterpriseService.revokeUserOrganizationAccess(
          request.tenantId,
          request.params.userId,
          request.params.organizationId,
        ))
      )
        throw new NotFoundError('Access not found.');
      await recordSecurityEvent(request, {
        tenantId: request.tenantId,
        actorUserId: request.user?.id,
        action: 'tenant.access.revoke',
        resourceType: 'user_organization_access',
        resourceId: request.params.userId,
        outcome: 'success',
        metadata: { organizationId: request.params.organizationId },
      });
      return { success: true, revoked: true };
    },
  );
};
export default tenantAdministrationRoutes;
