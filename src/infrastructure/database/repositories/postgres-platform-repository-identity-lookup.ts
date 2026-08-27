import type { Pool } from 'pg';

import type { LoginCandidate } from '../../../application/contracts/security.js';
import { PostgresPlatformRepository } from './postgres-platform-repository.js';

declare module './postgres-platform-repository.js' {
  interface PostgresPlatformRepository {
    findLoginCandidates(identifier: string): Promise<LoginCandidate[]>;
  }
}

const repositoryPrototype = PostgresPlatformRepository.prototype as PostgresPlatformRepository & {
  findLoginCandidates?: (identifier: string) => Promise<LoginCandidate[]>;
};

if (!repositoryPrototype.findLoginCandidates) {
  repositoryPrototype.findLoginCandidates = async function findLoginCandidates(identifier: string): Promise<LoginCandidate[]> {
    const normalized = identifier.trim();
    if (!normalized) {
      return [];
    }

    const pool = (this as unknown as { pool: Pool }).pool;
    const result = await pool.query<LoginCandidate>(
      `SELECT user_id as "userId", tenant_id as "tenantId"
       FROM auth_login_identifiers
       WHERE is_active = true
         AND identifier = $1::citext
       ORDER BY tenant_id, user_id`,
      [normalized],
    );

    return result.rows;
  };
}
