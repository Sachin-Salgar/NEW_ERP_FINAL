import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
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

function platformExecutor(request: FastifyRequest) {
  if (request.server.platformDbPool) return request.server.platformDbPool;
  if (request.server.appConfig.isTest) return request.server.dbPool;
  return undefined;
}

const platformTenantRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/platform/tenants', { preHandler: requirePlatformContext('platform.tenant.read') }, async (request) => ({
    success: true,
    tenants: await request.server.platformAuthorizationService.listTenants(),
  }));

  fastify.get<{ Params: { tenantId: string } }>(
    '/platform/tenants/:tenantId/modules',
    { preHandler: requirePlatformContext('platform.modules.manage') },
    async (request) => {
      const tenantId = request.params.tenantId;
      const result = await request.server.dbPool.query(
        `SELECT m.id, m.code, m.name, m.module_group AS "moduleGroup", m.description,
                m.icon, m.route, m.is_core AS "isCore", m.sort_order AS "sortOrder",
                COALESCE(tm.enabled, false) AS enabled,
                tm.enabled_at AS "enabledAt", tm.disabled_at AS "disabledAt"
           FROM modules m
           LEFT JOIN tenant_modules tm ON tm.module_id = m.id AND tm.tenant_id = $1
          ORDER BY m.sort_order, m.name`,
        [tenantId],
      );
      return { success: true, tenantId, modules: result.rows };
    },
  );

  fastify.patch<{
    Params: { tenantId: string; code: string };
    Body: { enabled: boolean };
  }>(
    '/platform/tenants/:tenantId/modules/:code',
    { preHandler: requirePlatformContext('platform.modules.manage') },
    async (request) => {
      const tenantId = request.params.tenantId;
      const code = request.params.code.trim();
      const enabled = request.body.enabled;
      const client = await fastify.dbPool.connect();
      try {
        await client.query('BEGIN');
        const moduleResult = await client.query(
          `SELECT id, code, name, module_group AS "moduleGroup", description, icon, route,
                  is_core AS "isCore", sort_order AS "sortOrder"
             FROM modules WHERE code = $1 LIMIT 1`,
          [code],
        );
        if (moduleResult.rowCount !== 1) throw new NotFoundError('Module not found.');
        const module = moduleResult.rows[0];
        if (!enabled && module.isCore) {
          throw new ValidationError('Core modules cannot be disabled.');
        }
        const tenantResult = await client.query(
          'SELECT id FROM tenants WHERE id = $1 AND is_deleted = false LIMIT 1',
          [tenantId],
        );
        if (tenantResult.rowCount !== 1) throw new NotFoundError('Tenant not found.');
        const result = await client.query(
          `INSERT INTO tenant_modules
             (tenant_id, module_id, enabled, enabled_at, disabled_at)
           VALUES ($1, $2, $3, CASE WHEN $3 THEN NOW() ELSE NULL END,
                   CASE WHEN $3 THEN NULL ELSE NOW() END)
           ON CONFLICT (tenant_id, module_id) DO UPDATE
             SET enabled = EXCLUDED.enabled,
                 enabled_at = CASE WHEN EXCLUDED.enabled THEN NOW() ELSE tenant_modules.enabled_at END,
                 disabled_at = CASE WHEN EXCLUDED.enabled THEN NULL ELSE NOW() END
           RETURNING enabled, enabled_at AS "enabledAt", disabled_at AS "disabledAt"`,
          [tenantId, module.id, enabled],
        );
        await client.query(
          `INSERT INTO audit_events
            (tenant_id, actor_identity_id, actor_platform_membership_id, context_type,
             target_tenant_id, action, resource_type, resource_id, outcome, metadata)
           VALUES (NULL, $1, $2, 'platform', $3, $4, 'tenant_module', $5, 'success',
                   jsonb_build_object('moduleCode', $6::text, 'enabled', $7::boolean))`,
          [
            request.identityId ?? null,
            request.platformMembershipId ?? null,
            tenantId,
            enabled ? 'platform.module.enable' : 'platform.module.disable',
            module.id,
            code,
            enabled,
          ],
        );
        await client.query('COMMIT');
        return { success: true, tenantId, module: { ...module, ...result.rows[0] } };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  );

  fastify.post<{
    Body: {
      name: string;
      displayName?: string;
      subdomain: string;
      slug: string;
      administrator: { username: string; email: string; password: string };
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
