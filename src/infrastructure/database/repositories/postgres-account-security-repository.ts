import type { Pool, PoolClient } from 'pg';

import type {
  AccountSecurityAccount,
  AccountSecurityRepository,
  AccountSecurityTokenRecord,
} from '../../../application/contracts/account-security.js';
import { withTenantContext } from '../tenant-context.js';

export class PostgresAccountSecurityRepository implements AccountSecurityRepository {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey: string,
  ) {}

  async findAccountCandidates(identifier: string): Promise<AccountSecurityAccount[]> {
    const normalized = identifier.trim();
    if (!normalized) return [];

    const identityResult = await this.pool.query<{ user_id: string; tenant_id: string }>(
      `SELECT DISTINCT i.user_id, i.tenant_id
       FROM auth_login_identifiers i
       WHERE i.is_active = true
         AND i.identifier = $1::citext
       ORDER BY i.tenant_id, i.user_id`,
      [normalized],
    );

    const accounts: AccountSecurityAccount[] = [];
    for (const candidate of identityResult.rows) {
      const account = await withTenantContext(this.pool, this.tenantContextKey, candidate.tenant_id, async (client) => {
        const result = await client.query<{
          id: string;
          tenant_id: string;
          email: string;
          status: string;
        }>(
          `SELECT id, tenant_id, email, status
             FROM users
             WHERE tenant_id = $1 AND id = $2 AND is_deleted = false
             LIMIT 1`,
          [candidate.tenant_id, candidate.user_id],
        );
        const row = result.rows[0];
        return row ? { id: row.id, tenantId: row.tenant_id, email: row.email, status: row.status } : null;
      });
      if (account) accounts.push(account);
    }

    return accounts;
  }

  async findUserByIdentifier(tenantId: string, identifier: string): Promise<AccountSecurityAccount | null> {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const result = await client.query<{
        id: string;
        tenant_id: string;
        email: string;
        status: string;
      }>(
        `SELECT id, tenant_id, email, status
         FROM users
         WHERE tenant_id = $1
           AND is_deleted = false
           AND (lower(email) = lower($2) OR lower(username) = lower($2))
         LIMIT 1`,
        [tenantId, identifier],
      );
      const row = result.rows[0];
      return row ? { id: row.id, tenantId: row.tenant_id, email: row.email, status: row.status } : null;
    });
  }

  async createEmailVerificationToken(record: AccountSecurityTokenRecord): Promise<void> {
    await withTenantContext(this.pool, this.tenantContextKey, record.tenantId, async (client) => {
      await client.query(
        `UPDATE email_verification_tokens
         SET consumed_at = NOW()
         WHERE tenant_id = $1 AND user_id = $2 AND consumed_at IS NULL`,
        [record.tenantId, record.userId],
      );
      await client.query(
        `INSERT INTO email_verification_tokens (tenant_id, user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [record.tenantId, record.userId, record.tokenHash, record.expiresAt],
      );
    });
  }

  async consumeEmailVerificationToken(tenantId: string, tokenHash: string, consumedAt: Date): Promise<boolean> {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const userId = await consumeToken(client, 'email_verification_tokens', tenantId, tokenHash, consumedAt);
      if (!userId) return false;

      const result = await client.query(
        `UPDATE users
         SET email_verified_at = COALESCE(email_verified_at, $3),
             status = CASE WHEN status = 'pending_verification' THEN 'active' ELSE status END,
             updated_at = $3,
             version = version + 1
         WHERE tenant_id = $1 AND id = $2 AND is_deleted = false`,
        [tenantId, userId, consumedAt],
      );
      return (result.rowCount ?? 0) === 1;
    });
  }

  async createPasswordResetToken(record: AccountSecurityTokenRecord): Promise<void> {
    await withTenantContext(this.pool, this.tenantContextKey, record.tenantId, async (client) => {
      await client.query(
        `UPDATE password_reset_tokens
         SET consumed_at = NOW()
         WHERE tenant_id = $1 AND user_id = $2 AND consumed_at IS NULL`,
        [record.tenantId, record.userId],
      );
      await client.query(
        `INSERT INTO password_reset_tokens (tenant_id, user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [record.tenantId, record.userId, record.tokenHash, record.expiresAt],
      );
    });
  }

  async consumePasswordResetToken(
    tenantId: string,
    tokenHash: string,
    passwordHash: string,
    consumedAt: Date,
  ): Promise<boolean> {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const userId = await consumeToken(client, 'password_reset_tokens', tenantId, tokenHash, consumedAt);
      if (!userId) return false;

      const result = await client.query(
        `UPDATE users
         SET password_hash = $3,
             password_changed_at = $4,
             password_reset_token_hash = NULL,
             password_reset_expires_at = NULL,
             failed_login_count = 0,
             locked_until = NULL,
             updated_at = $4,
             version = version + 1
         WHERE tenant_id = $1 AND id = $2 AND is_deleted = false`,
        [tenantId, userId, passwordHash, consumedAt],
      );
      if ((result.rowCount ?? 0) !== 1) return false;

      await client.query(
        `UPDATE user_sessions
         SET is_active = false,
             revoked_at = COALESCE(revoked_at, $3),
             logout_at = COALESCE(logout_at, $3),
             termination_reason = COALESCE(termination_reason, 'password_reset'),
             updated_at = $3,
             version = version + 1
         WHERE tenant_id = $1 AND user_id = $2 AND is_active = true`,
        [tenantId, userId, consumedAt],
      );
      return true;
    });
  }
}

async function consumeToken(
  client: PoolClient,
  table: 'email_verification_tokens' | 'password_reset_tokens',
  tenantId: string,
  tokenHash: string,
  consumedAt: Date,
): Promise<string | null> {
  const result = await client.query<{ user_id: string }>(
    `UPDATE ${table}
     SET consumed_at = $3
     WHERE tenant_id = $1
       AND token_hash = $2
       AND consumed_at IS NULL
       AND expires_at > $3
     RETURNING user_id`,
    [tenantId, tokenHash, consumedAt],
  );
  return result.rows[0]?.user_id ?? null;
}
