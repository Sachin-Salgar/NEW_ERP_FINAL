import type { Pool } from 'pg';

import type { LoginCandidate } from '../../../application/contracts/security.js';
import { PostgresPlatformRepository } from './postgres-platform-repository.js';

/**
 * Adds the deployment-independent login lookup required by identity-based tenant discovery.
 *
 * This lookup returns only candidate user/tenant identities. Password verification and all
 * tenant-owned user reads continue through PostgresPlatformRepository under RLS tenant context.
 */
export class IdentityAwarePostgresPlatformRepository extends PostgresPlatformRepository {
  constructor(pool: Pool, tenantContextKey = 'app.current_tenant_id') {
    super(pool, tenantContextKey);
    this.poolForIdentityLookup = pool;
  }

  private readonly poolForIdentityLookup: Pool;

  async findLoginCandidates(identifier: string): Promise<LoginCandidate[]> {
    const normalized = identifier.trim();
    if (!normalized) {
      return [];
    }

    const result = await this.poolForIdentityLookup.query<LoginCandidate>(
      `SELECT user_id as "userId", tenant_id as "tenantId"
       FROM auth_login_identifiers
       WHERE is_active = true
         AND identifier = $1::citext
       ORDER BY tenant_id, user_id`,
      [normalized],
    );

    return result.rows;
  }
}
