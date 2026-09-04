import type { Pool } from 'pg';

import type { LoginCandidate } from '../../../domain/contracts/repositories.js';
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

    const pool = (this as unknown as { pool: Pool; tenantContextKey?: string }).pool;
    const client = await pool.connect();

    try {
      const result = await client.query<LoginCandidate>(
       `SELECT i.user_id as "userId", i.tenant_id as "tenantId"
         FROM auth_login_identifiers i
         WHERE i.is_active = true
           AND i.tenant_id::text <> ''
           AND i.user_id::text <> ''
           AND i.identifier = $1::citext
         ORDER BY i.tenant_id, i.user_id`,
       [normalized],
      );

      return result.rows;
    } finally {
      client.release();
    }
  };
}
