// @ts-nocheck
import type { Pool } from 'pg';
import type {
  PlatformAuthorizationRepository,
  PlatformContext,
  PlatformTenantRecord,
} from '../../../domain/contracts/platform-authorization.js';

export class PostgresPlatformAuthorizationRepository implements PlatformAuthorizationRepository {
  constructor(private readonly pool: Pool) {}

  async validateContext(sessionId: string, identityId: string): Promise<PlatformContext | null> {
    const result = await this.pool.query<PlatformContext>(
      `SELECT s.id as "sessionId", s.identity_id as "identityId", s.platform_membership_id as "platformMembershipId"
       FROM user_sessions s
       JOIN platform_memberships m ON m.id = s.platform_membership_id
       JOIN identities i ON i.id = s.identity_id
       WHERE s.id = $1 AND s.identity_id = $2 AND s.context_type = 'platform'
         AND s.is_active = true AND s.expires_at > NOW()
         AND m.status = 'active' AND i.status = 'active'
       LIMIT 1`,
      [sessionId, identityId],
    );
    return result.rows[0] ?? null;
  }

  async hasPermission(platformMembershipId: string, permissionKey: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1
       FROM platform_membership_roles mr
       JOIN platform_role_permissions rp ON rp.platform_role_id = mr.platform_role_id
       JOIN platform_permissions p ON p.id = rp.platform_permission_id
       WHERE mr.platform_membership_id = $1 AND p.permission_key = $2
       LIMIT 1`,
      [platformMembershipId, permissionKey],
    );
    return result.rowCount === 1;
  }

  async listTenants(): Promise<PlatformTenantRecord[]> {
    const result = await this.pool.query<PlatformTenantRecord>(
      `SELECT id, name, display_name as "displayName", subdomain, slug, timezone, currency, locale, status,
              created_at as "createdAt", updated_at as "updatedAt", is_deleted as "isDeleted"
       FROM tenants ORDER BY created_at DESC, id`,
    );
    return result.rows;
  }
}
