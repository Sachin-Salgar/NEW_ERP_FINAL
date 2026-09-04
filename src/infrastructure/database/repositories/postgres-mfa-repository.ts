import type { Pool } from 'pg';

import type { MfaRepository } from '../../../application/contracts/mfa.js';
import { withTenantContext } from '../tenant-context.js';

export class PostgresMfaRepository implements MfaRepository {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey: string,
  ) {}

  async createEnrollment(tenantId: string, userId: string, encryptedSecret: string, expiresAt: Date): Promise<void> {
    await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      await client.query(`DELETE FROM mfa_enrollments WHERE tenant_id = $1 AND user_id = $2`, [tenantId, userId]);
      await client.query(
        `INSERT INTO mfa_enrollments (tenant_id, user_id, encrypted_secret, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [tenantId, userId, encryptedSecret, expiresAt],
      );
    });
  }

  async getPendingEnrollment(
    tenantId: string,
    userId: string,
  ): Promise<{ encryptedSecret: string; expiresAt: Date } | null> {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const result = await client.query<{ encrypted_secret: string; expires_at: Date }>(
        `SELECT encrypted_secret, expires_at
         FROM mfa_enrollments
         WHERE tenant_id = $1 AND user_id = $2
         LIMIT 1`,
        [tenantId, userId],
      );
      const row = result.rows[0];
      return row ? { encryptedSecret: row.encrypted_secret, expiresAt: new Date(row.expires_at) } : null;
    });
  }

  async activateEnrollment(
    tenantId: string,
    userId: string,
    encryptedSecret: string,
    recoveryCodeHashes: string[],
  ): Promise<void> {
    await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const enrollment = await client.query(
        `DELETE FROM mfa_enrollments
         WHERE tenant_id = $1 AND user_id = $2 AND expires_at > NOW()
         RETURNING user_id`,
        [tenantId, userId],
      );
      if ((enrollment.rowCount ?? 0) !== 1) throw new Error('MFA enrollment is missing or expired');

      const user = await client.query(
        `UPDATE users
         SET encrypted_mfa_secret = $3,
             mfa_enabled = true,
             updated_at = NOW(),
             version = version + 1
         WHERE tenant_id = $1 AND id = $2 AND is_deleted = false`,
        [tenantId, userId, encryptedSecret],
      );
      if ((user.rowCount ?? 0) !== 1) throw new Error('User not found for MFA enrollment');

      await client.query(`DELETE FROM mfa_recovery_codes WHERE tenant_id = $1 AND user_id = $2`, [tenantId, userId]);
      for (const recoveryCodeHash of recoveryCodeHashes) {
        await client.query(
          `INSERT INTO mfa_recovery_codes (tenant_id, user_id, code_hash)
           VALUES ($1, $2, $3)`,
          [tenantId, userId, recoveryCodeHash],
        );
      }
    });
  }

  async getEnabledSecret(tenantId: string, userId: string): Promise<string | null> {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const result = await client.query<{ encrypted_mfa_secret: string | null }>(
        `SELECT encrypted_mfa_secret
         FROM users
         WHERE tenant_id = $1 AND id = $2 AND is_deleted = false AND mfa_enabled = true
         LIMIT 1`,
        [tenantId, userId],
      );
      return result.rows[0]?.encrypted_mfa_secret ?? null;
    });
  }

  async consumeRecoveryCode(tenantId: string, userId: string, recoveryCodeHash: string): Promise<boolean> {
    return withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      const result = await client.query(
        `UPDATE mfa_recovery_codes
         SET consumed_at = NOW()
         WHERE tenant_id = $1
           AND user_id = $2
           AND code_hash = $3
           AND consumed_at IS NULL`,
        [tenantId, userId, recoveryCodeHash],
      );
      return (result.rowCount ?? 0) === 1;
    });
  }

  async disableMfa(tenantId: string, userId: string): Promise<void> {
    await withTenantContext(this.pool, this.tenantContextKey, tenantId, async (client) => {
      await client.query(
        `UPDATE users
         SET encrypted_mfa_secret = NULL,
             mfa_enabled = false,
             updated_at = NOW(),
             version = version + 1
         WHERE tenant_id = $1 AND id = $2 AND is_deleted = false`,
        [tenantId, userId],
      );
      await client.query(`DELETE FROM mfa_enrollments WHERE tenant_id = $1 AND user_id = $2`, [tenantId, userId]);
      await client.query(`DELETE FROM mfa_recovery_codes WHERE tenant_id = $1 AND user_id = $2`, [tenantId, userId]);
    });
  }
}
