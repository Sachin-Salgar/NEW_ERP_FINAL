import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { NotFoundError } from '../../../domain/errors.js';
import { requirePlatformContext } from '../middleware/auth.js';

const uuid = z.string().uuid();
const roleBody = z.object({ code: z.string().trim().min(2).max(80), name: z.string().trim().min(2).max(150), description: z.string().trim().max(1000).nullable().optional() });
const policyBody = z.object({
  mfaRequired: z.boolean().optional(),
  sessionLifetimeMinutes: z.number().int().min(5).max(43200).optional(),
  maxFailedLoginAttempts: z.number().int().min(1).max(20).optional(),
  lockoutMinutes: z.number().int().min(1).max(1440).optional(),
});

async function audit(client: { query: (text: string, values?: unknown[]) => Promise<unknown> }, request: { identityId?: string; platformMembershipId?: string }, action: string, resourceType: string, resourceId: string | null, targetTenantId: string | null) {
  await client.query(
    `INSERT INTO audit_events
      (tenant_id, actor_identity_id, actor_platform_membership_id, context_type, target_tenant_id,
       action, resource_type, resource_id, outcome, metadata)
     VALUES (NULL, $1, $2, 'platform', $3, $4, $5, $6, 'success', '{}'::jsonb)`,
    [request.identityId ?? null, request.platformMembershipId ?? null, targetTenantId, action, resourceType, resourceId],
  );
}

const platformAdministrationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/platform/members', { preHandler: requirePlatformContext('platform.members.manage') }, async () => {
    const result = await fastify.dbPool.query(
      `SELECT m.id, m.identity_id AS "identityId", m.status, m.created_at AS "createdAt",
              i.status AS "identityStatus",
              COALESCE(string_agg(DISTINCT r.code, ',' ORDER BY r.code), '') AS roles
       FROM platform_memberships m
       JOIN identities i ON i.id = m.identity_id
       LEFT JOIN platform_membership_roles mr ON mr.platform_membership_id = m.id
       LEFT JOIN platform_roles r ON r.id = mr.platform_role_id AND r.is_deleted = false
       GROUP BY m.id, i.status ORDER BY m.created_at DESC`,
    );
    return { success: true, members: result.rows };
  });

  fastify.post<{ Body: { identityId: string; roleIds?: string[] } }>('/platform/members', { preHandler: requirePlatformContext('platform.members.manage') }, async (request, reply) => {
    const identityId = uuid.parse(request.body.identityId);
    const roleIds = (request.body.roleIds ?? []).map((id) => uuid.parse(id));
    const client = await fastify.dbPool.connect();
    try {
      await client.query('BEGIN');
      const identity = await client.query('SELECT id FROM identities WHERE id = $1 AND status = $2 FOR UPDATE', [identityId, 'active']);
      if (identity.rowCount !== 1) throw new NotFoundError('Active identity not found.');
      const membership = await client.query(
        `INSERT INTO platform_memberships (identity_id, status, activated_at)
         VALUES ($1, 'active', now()) RETURNING id, identity_id AS "identityId", status`,
        [identityId],
      );
      for (const roleId of roleIds) await client.query('INSERT INTO platform_membership_roles (platform_membership_id, platform_role_id) VALUES ($1, $2)', [membership.rows[0].id, roleId]);
      await audit(client, request, 'platform.membership.create', 'platform_membership', membership.rows[0].id, null);
      await client.query('COMMIT');
      reply.code(201);
      return { success: true, member: membership.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  });

  fastify.patch<{ Params: { membershipId: string }; Body: { status?: 'active' | 'suspended' | 'revoked'; roleIds?: string[] } }>('/platform/members/:membershipId', { preHandler: requirePlatformContext('platform.members.manage') }, async (request) => {
    const membershipId = uuid.parse(request.params.membershipId);
    const client = await fastify.dbPool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query('SELECT id FROM platform_memberships WHERE id = $1 FOR UPDATE', [membershipId]);
      if (current.rowCount !== 1) throw new NotFoundError('Platform membership not found.');
      if (request.body.status) await client.query(`UPDATE platform_memberships SET status = $2, updated_at = now(), revoked_at = CASE WHEN $2 = 'revoked' THEN now() ELSE revoked_at END WHERE id = $1`, [membershipId, request.body.status]);
      if (request.body.roleIds) {
        const roleIds = request.body.roleIds.map((id) => uuid.parse(id));
        await client.query('DELETE FROM platform_membership_roles WHERE platform_membership_id = $1', [membershipId]);
        for (const roleId of roleIds) await client.query('INSERT INTO platform_membership_roles (platform_membership_id, platform_role_id) VALUES ($1, $2)', [membershipId, roleId]);
      }
      await client.query('UPDATE user_sessions SET is_active = false WHERE platform_membership_id = $1 AND $2 IN (\'suspended\', \'revoked\')', [membershipId, request.body.status ?? 'active']);
      await audit(client, request, 'platform.membership.update', 'platform_membership', membershipId, null);
      await client.query('COMMIT');
      return { success: true, updated: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  });

  fastify.get('/platform/roles', { preHandler: requirePlatformContext('platform.roles.manage') }, async () => {
    const result = await fastify.dbPool.query(
      `SELECT r.id, r.code, r.name, r.description, r.is_system AS "isSystem", r.is_deleted AS "isDeleted",
              COALESCE(json_agg(json_build_object('id', p.id, 'permissionKey', p.permission_key)) FILTER (WHERE p.id IS NOT NULL), '[]') AS permissions
       FROM platform_roles r
       LEFT JOIN platform_role_permissions rp ON rp.platform_role_id = r.id
       LEFT JOIN platform_permissions p ON p.id = rp.platform_permission_id
       WHERE r.is_deleted = false GROUP BY r.id ORDER BY r.name`,
    );
    return { success: true, roles: result.rows };
  });

  fastify.post<{ Body: z.infer<typeof roleBody> }>('/platform/roles', { preHandler: requirePlatformContext('platform.roles.manage') }, async (request, reply) => {
    const body = roleBody.parse(request.body);
    const result = await fastify.dbPool.query('INSERT INTO platform_roles (code, name, description) VALUES ($1, $2, $3) RETURNING id, code, name, description', [body.code, body.name, body.description ?? null]);
    reply.code(201);
    return { success: true, role: result.rows[0] };
  });

  fastify.patch<{ Params: { roleId: string }; Body: Partial<z.infer<typeof roleBody>> & { isDeleted?: boolean } }>('/platform/roles/:roleId', { preHandler: requirePlatformContext('platform.roles.manage') }, async (request) => {
    const roleId = uuid.parse(request.params.roleId);
    const body = request.body;
    const result = await fastify.dbPool.query(
      `UPDATE platform_roles SET code = COALESCE($2, code), name = COALESCE($3, name),
       description = COALESCE($4, description), is_deleted = COALESCE($5, is_deleted), updated_at = now()
       WHERE id = $1 AND is_system = false RETURNING id, code, name, description, is_deleted AS "isDeleted"`,
      [roleId, body.code ?? null, body.name ?? null, body.description ?? null, body.isDeleted ?? null],
    );
    if (result.rowCount !== 1) throw new NotFoundError('Editable platform role not found.');
    return { success: true, role: result.rows[0] };
  });

  fastify.put<{ Params: { roleId: string }; Body: { permissionIds: string[] } }>('/platform/roles/:roleId/permissions', { preHandler: requirePlatformContext('platform.permissions.manage') }, async (request) => {
    const roleId = uuid.parse(request.params.roleId);
    const permissionIds = request.body.permissionIds.map((id) => uuid.parse(id));
    const client = await fastify.dbPool.connect();
    try {
      await client.query('BEGIN');
      const role = await client.query('SELECT id FROM platform_roles WHERE id = $1 AND is_system = false AND is_deleted = false FOR UPDATE', [roleId]);
      if (role.rowCount !== 1) throw new NotFoundError('Editable platform role not found.');
      await client.query('DELETE FROM platform_role_permissions WHERE platform_role_id = $1', [roleId]);
      for (const permissionId of permissionIds) await client.query('INSERT INTO platform_role_permissions (platform_role_id, platform_permission_id) VALUES ($1, $2)', [roleId, permissionId]);
      await audit(client, request, 'platform.role.permissions.update', 'platform_role', roleId, null);
      await client.query('COMMIT');
      return { success: true, updated: true };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });

  fastify.get('/platform/security-policy', { preHandler: requirePlatformContext('platform.security.manage') }, async () => {
    const result = await fastify.dbPool.query('SELECT mfa_required AS "mfaRequired", session_lifetime_minutes AS "sessionLifetimeMinutes", max_failed_login_attempts AS "maxFailedLoginAttempts", lockout_minutes AS "lockoutMinutes", updated_at AS "updatedAt" FROM platform_security_policy WHERE id = true');
    return { success: true, policy: result.rows[0] };
  });

  fastify.patch<{ Body: z.infer<typeof policyBody> }>('/platform/security-policy', { preHandler: requirePlatformContext('platform.security.manage') }, async (request) => {
    const body = policyBody.parse(request.body);
    const client = await fastify.dbPool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE platform_security_policy SET mfa_required = COALESCE($1, mfa_required),
         session_lifetime_minutes = COALESCE($2, session_lifetime_minutes),
         max_failed_login_attempts = COALESCE($3, max_failed_login_attempts),
         lockout_minutes = COALESCE($4, lockout_minutes), updated_at = now()
         WHERE id = true RETURNING mfa_required AS "mfaRequired", session_lifetime_minutes AS "sessionLifetimeMinutes", max_failed_login_attempts AS "maxFailedLoginAttempts", lockout_minutes AS "lockoutMinutes"`,
        [body.mfaRequired ?? null, body.sessionLifetimeMinutes ?? null, body.maxFailedLoginAttempts ?? null, body.lockoutMinutes ?? null],
      );
      await audit(client, request, 'platform.security_policy.update', 'platform_security_policy', 'global', null);
      await client.query('COMMIT');
      return { success: true, policy: result.rows[0] };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });

  fastify.get('/platform/audit', { preHandler: requirePlatformContext('platform.audit.read') }, async (_request) => {
    const client = await fastify.dbPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.platform_audit_enabled', 'true', true)`);
      const result = await client.query(
        `SELECT id, action, resource_type AS "resourceType", resource_id AS "resourceId",
                actor_identity_id AS "actorIdentityId", actor_platform_membership_id AS "platformMembershipId",
                target_tenant_id AS "targetTenantId", outcome, metadata, created_at AS "createdAt"
         FROM audit_events WHERE context_type = 'platform' ORDER BY created_at DESC LIMIT 200`,
      );
      await client.query('COMMIT');
      return { success: true, events: result.rows };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });

  fastify.get('/platform/audit/export', { preHandler: requirePlatformContext('platform.audit.export') }, async () => {
    const result = await fastify.dbPool.query(
      `SELECT id, action, resource_type AS "resourceType", resource_id AS "resourceId",
              actor_identity_id AS "actorIdentityId", actor_platform_membership_id AS "platformMembershipId",
              target_tenant_id AS "targetTenantId", outcome, metadata, created_at AS "createdAt"
       FROM audit_events WHERE context_type = 'platform' ORDER BY created_at DESC`,
    );
    return { success: true, events: result.rows };
  });
};

export default platformAdministrationRoutes;
