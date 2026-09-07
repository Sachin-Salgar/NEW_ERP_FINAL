import type { FastifyPluginAsync } from 'fastify';
import { NotFoundError, ValidationError } from '../../../domain/errors.js';
import { DEFAULT_PLATFORM_SEED } from '../../../application/services/platform-bootstrap-service.js';
import { requirePlatformContext } from '../middleware/auth.js';

const tenantPermissions = DEFAULT_PLATFORM_SEED.permissions
  .filter((permission) => permission.scope !== 'global')
  .filter(
    (permission) =>
      ![
        'tenant.create',
        'tenant.delete',
        'tenant.activate',
        'tenant.deactivate',
        'tenant.suspend',
        'tenant.reactivate',
      ].includes(permission.permissionKey),
  )
  .map((permission) => permission.permissionKey);

function platformExecutor(request: Parameters<FastifyPluginAsync>[0]['addHook'] extends never ? never : any) {
  return request.server.platformDbPool;
}

const platformTenantRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/platform/tenants', { preHandler: requirePlatformContext('platform.tenant.read') }, async (request) => ({
    success: true,
    tenants: await request.server.platformAuthorizationService.listTenants(),
  }));

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
  }>('/platform/tenants', { preHandler: requirePlatformContext('platform.tenant.create') }, async (request, reply) => {
    const body = request.body;
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
      permissions: tenantPermissions,
    });
    reply.code(201);
    return { success: true, ...result };
  });

  fastify.patch<{
    Params: { tenantId: string };
    Body: { name?: string; displayName?: string | null; timezone?: string; currency?: string; locale?: string };
  }>(
    '/platform/tenants/:tenantId',
    { preHandler: requirePlatformContext('platform.tenant.update') },
    async (request) => {
      const tenant = await request.server.tenantAdministrationService.update(request.params.tenantId, request.body);
      if (!tenant) throw new NotFoundError('Tenant not found.');
      return { success: true, tenant };
    },
  );

  for (const [action, permission] of [
    ['activate', 'platform.tenant.activate'],
    ['deactivate', 'platform.tenant.deactivate'],
    ['suspend', 'platform.tenant.suspend'],
    ['reactivate', 'platform.tenant.reactivate'],
  ] as const) {
    fastify.post<{ Params: { tenantId: string } }>(
      `/platform/tenants/:tenantId/${action}`,
      { preHandler: requirePlatformContext(permission) },
      async (request) => {
        const platformPool = platformExecutor(request);
        if (!platformPool) throw new Error('Platform database executor is not configured.');
        const status = action === 'deactivate' ? 'cancelled' : action === 'suspend' ? 'suspended' : 'active';
        await platformPool.query('SELECT platform_update_tenant_status($1::uuid, $2::text)', [
          request.params.tenantId,
          status,
        ]);
        const tenant = (await request.server.platformAuthorizationService.listTenants()).find(
          (candidate) => candidate.id === request.params.tenantId,
        );
        if (!tenant) throw new NotFoundError('Tenant not found.');
        return { success: true, tenant };
      },
    );
  }

  fastify.delete<{ Params: { tenantId: string } }>(
    '/platform/tenants/:tenantId',
    { preHandler: requirePlatformContext('platform.tenant.delete') },
    async (request) => {
      if (!request.params.tenantId) throw new ValidationError('Tenant identifier is required.');
      const platformPool = platformExecutor(request);
      if (!platformPool) throw new Error('Platform database executor is not configured.');
      await platformPool.query('SELECT platform_delete_tenant($1::uuid)', [request.params.tenantId]);
      return { success: true, deleted: true };
    },
  );
};

export default platformTenantRoutes;
