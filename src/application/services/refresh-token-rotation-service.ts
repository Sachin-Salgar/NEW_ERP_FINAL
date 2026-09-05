import type { Pool } from 'pg';

import type { TokenService } from '../contracts/security.js';
import { UnauthorizedError } from '../../domain/errors.js';
import { withTenantContext } from '../../infrastructure/database/tenant-context.js';
import type { AuthenticatedUser } from '../../domain/contracts/authentication.js';

export interface RefreshRotationResult {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  userId: string;
  tenantId: string;
  sessionId: string;
  user: AuthenticatedUser;
}

type RotationOutcome = { kind: 'rotated'; result: RefreshRotationResult } | { kind: 'reused' } | { kind: 'invalid' };

export class RefreshTokenRotationService {
  constructor(
    private readonly pool: Pool,
    private readonly tenantContextKey: string,
    private readonly tokenService: TokenService,
  ) {}

  async rotate(refreshToken: string): Promise<RefreshRotationResult> {
    const claims = this.tokenService.verifyRefreshToken(refreshToken);
    const oldHash = this.tokenService.hashTokenValue(refreshToken);

    const outcome = await withTenantContext(
      this.pool,
      this.tenantContextKey,
      claims.tenantId,
      async (client): Promise<RotationOutcome> => {
        const sessionResult = await client.query<{
          id: string;
          user_id: string;
          refresh_token_hash: string;
          is_active: boolean;
          expires_at: Date;
        }>(
          `SELECT id, user_id, refresh_token_hash, is_active, expires_at
           FROM user_sessions
           WHERE tenant_id = $1 AND id = $2
           FOR UPDATE`,
          [claims.tenantId, claims.sessionId],
        );
        const session = sessionResult.rows[0];

        if (!session || session.user_id !== claims.sub) {
          return { kind: 'invalid' };
        }

        if (session.refresh_token_hash !== oldHash) {
          const replay = await client.query(
            `SELECT 1
             FROM refresh_token_history
             WHERE tenant_id = $1 AND session_id = $2 AND token_hash = $3
             LIMIT 1`,
            [claims.tenantId, claims.sessionId, oldHash],
          );

          if ((replay.rowCount ?? 0) > 0) {
            await client.query(
              `UPDATE user_sessions
               SET is_active = false,
                   revoked_at = COALESCE(revoked_at, NOW()),
                   termination_reason = 'refresh_token_reuse',
                   updated_at = NOW(),
                   version = version + 1
               WHERE tenant_id = $1 AND id = $2`,
              [claims.tenantId, claims.sessionId],
            );
            return { kind: 'reused' };
          }

          return { kind: 'invalid' };
        }

        if (!session.is_active || new Date(session.expires_at).getTime() <= Date.now()) {
          return { kind: 'invalid' };
        }

        const userResult = await client.query<{
          id: string;
          tenant_id: string;
          username: string;
          email: string;
          status: string;
          default_location_id: string | null;
          default_branch_id: string | null;
          organization_id: string | null;
          location_id: string | null;
        }>(
          `SELECT u.id, u.tenant_id, u.username, u.email, u.status,
                  u.default_location_id, u.default_branch_id,
                  s.organization_id, s.location_id
           FROM users u
           JOIN user_sessions s ON s.tenant_id = u.tenant_id AND s.user_id = u.id AND s.id = $3
           WHERE u.tenant_id = $1 AND u.id = $2 AND u.status = 'active'`,
          [claims.tenantId, session.user_id, session.id],
        );
        if ((userResult.rowCount ?? 0) !== 1) {
          return { kind: 'invalid' };
        }
        const user = userResult.rows[0];

        const refreshTokenReplacement = this.tokenService.createRefreshToken({
          userId: session.user_id,
          tenantId: claims.tenantId,
          sessionId: session.id,
          expiresInSeconds: 60 * 60 * 24 * 14,
        });
        const replacementHash = this.tokenService.hashTokenValue(refreshTokenReplacement);
        const consumedAt = new Date();

        const historyInsert = await client.query(
          `INSERT INTO refresh_token_history (
             tenant_id, session_id, user_id, token_hash, replaced_by_hash, consumed_at
           ) VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (tenant_id, token_hash) DO NOTHING`,
          [claims.tenantId, session.id, session.user_id, oldHash, replacementHash, consumedAt],
        );
        if ((historyInsert.rowCount ?? 0) !== 1) {
          await client.query(
            `UPDATE user_sessions
             SET is_active = false,
                 revoked_at = COALESCE(revoked_at, NOW()),
                 termination_reason = 'refresh_token_reuse',
                 updated_at = NOW(),
                 version = version + 1
             WHERE tenant_id = $1 AND id = $2`,
            [claims.tenantId, session.id],
          );
          return { kind: 'reused' };
        }

        const update = await client.query(
          `UPDATE user_sessions
           SET refresh_token_hash = $4,
               last_activity_at = $5,
               updated_at = $5,
               version = version + 1
           WHERE tenant_id = $1
             AND id = $2
             AND user_id = $3
             AND refresh_token_hash = $6
             AND is_active = true`,
          [claims.tenantId, session.id, session.user_id, replacementHash, consumedAt, oldHash],
        );
        if ((update.rowCount ?? 0) !== 1) {
          throw new Error('Refresh token rotation lost its session lock invariant');
        }

        const accessTtlSeconds = 60 * 60;
        const accessToken = this.tokenService.createAccessToken({
          userId: session.user_id,
          tenantId: claims.tenantId,
          sessionId: session.id,
          expiresInSeconds: accessTtlSeconds,
        });

        return {
          kind: 'rotated',
          result: {
            accessToken,
            refreshToken: refreshTokenReplacement,
            accessTokenExpiresAt: new Date(Date.now() + accessTtlSeconds * 1000),
            userId: session.user_id,
            tenantId: claims.tenantId,
            sessionId: session.id,
            user: {
              id: user.id,
              tenantId: user.tenant_id,
              organizationId: user.organization_id,
              activeLocationId: user.location_id,
              defaultLocationId: user.default_location_id,
              defaultBranchId: user.default_branch_id,
              username: user.username,
              email: user.email,
              status: user.status,
            },
          },
        };
      },
    );

    if (outcome.kind === 'rotated') return outcome.result;
    if (outcome.kind === 'reused') {
      throw new UnauthorizedError('Refresh token reuse detected. The session has been revoked.');
    }
    throw new UnauthorizedError('Refresh token is invalid or expired.');
  }
}
