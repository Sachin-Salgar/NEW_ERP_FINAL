import { validate as isUuid, v7 as uuidV7 } from 'uuid';

import type { AuthenticatedUser, AuthenticationResult, SessionRecord } from '../../domain/contracts/authentication.js';
import type { AuthenticationRepository, PasswordHasher, TokenService } from '../contracts/security.js';

export class AuthenticationService {
  constructor(
    private readonly authenticationRepository: AuthenticationRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService?: TokenService,
  ) {}

  /**
   * Authenticate without deployment/host tenant resolution.
   * The identity lookup returns candidate tenant accounts; password verification then occurs
   * against each candidate through the tenant-scoped repository/RLS path.
   */
  async authenticate(identifier: string, password: string): Promise<AuthenticationResult> {
    const candidates = await this.authenticationRepository.findLoginCandidates(identifier);
    if (candidates.length === 0) {
      return { success: false, reason: 'INVALID_CREDENTIALS' };
    }

    // A single account may legitimately have multiple matching identifiers (for example,
    // its email and username can be identical). Identity lookup therefore operates at the
    // identifier level, while authentication must operate at the unique tenant/user level.
    const uniqueCandidates = [...new Map(
      candidates.map((candidate) => [`${candidate.tenantId}:${candidate.userId}`, candidate]),
    ).values()];

    let matchedUser: Awaited<ReturnType<AuthenticationRepository['findById']>> = null;
    let matchedTenantId: string | null = null;

    for (const candidate of uniqueCandidates) {
      if (!candidate.tenantId || !isUuid(candidate.tenantId) || !candidate.userId || !isUuid(candidate.userId)) {
        continue;
      }

      const user = await this.authenticationRepository.findById(candidate.tenantId, candidate.userId);
      if (!user || user.status !== 'active') {
        continue;
      }

      const validPassword = await this.passwordHasher.verify(password, user.passwordHash);
      if (!validPassword) {
        continue;
      }

      if (matchedUser) {
        // The same credentials identify multiple active tenant accounts. Do not guess the tenant.
        return { success: false, reason: 'INVALID_CREDENTIALS' };
      }

      matchedUser = user;
      matchedTenantId = candidate.tenantId;
    }

    if (!matchedUser || !matchedTenantId) {
      return { success: false, reason: 'INVALID_CREDENTIALS' };
    }

    const tenantId = matchedTenantId;
    const user = matchedUser;
    const sessionId = uuidV7();
    const sessionExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 8);
    const refreshToken = this.tokenService ? this.tokenService.createRefreshToken({
      userId: user.id,
      tenantId,
      sessionId,
      expiresInSeconds: 60 * 60 * 24 * 14,
    }) : 'internal-session-token';

    const session = await this.authenticationRepository.createSession({
      id: sessionId,
      tenantId,
      userId: user.id,
      organizationId: user.organizationId ?? null,
      locationId: null,
      branchId: user.defaultBranchId ?? null,
      accessTokenId: null,
      expiresAt: sessionExpiresAt,
      userAgent: 'erp-client',
      ipAddress: null,
      device: 'unknown',
      refreshTokenHash: this.tokenService ? this.tokenService.hashTokenValue(refreshToken) : 'internal-session-token',
    });

    const accessToken = this.tokenService ? this.tokenService.createAccessToken({
      userId: user.id,
      tenantId,
      sessionId: session.id,
      expiresInSeconds: 60 * 60,
    }) : undefined;

    return {
      success: true,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        organizationId: user.organizationId,
        defaultBranchId: user.defaultBranchId,
        username: user.username,
        email: user.email,
        status: user.status,
      },
      session,
      accessToken,
      refreshToken: this.tokenService ? refreshToken : undefined,
    };
  }

  async createSessionForUser(tenantId: string, userId: string, organizationId?: string | null, locationId?: string | null): Promise<AuthenticationResult> {
    const user = await this.authenticationRepository.findById(tenantId, userId);
    if (!user) {
      return { success: false, reason: 'USER_NOT_FOUND' };
    }

    if (user.status !== 'active') {
      return { success: false, reason: 'USER_INACTIVE' };
    }

    const sessionId = uuidV7();
    const sessionExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 8);
    const refreshToken = this.tokenService ? this.tokenService.createRefreshToken({
      userId: user.id,
      tenantId,
      sessionId,
      expiresInSeconds: 60 * 60 * 24 * 14,
    }) : 'internal-session-token';

    const effectiveOrganizationId = organizationId === undefined ? user.organizationId ?? null : organizationId;
    const session = await this.authenticationRepository.createSession({
      id: sessionId,
      tenantId,
      userId: user.id,
      organizationId: effectiveOrganizationId,
      locationId: locationId ?? null,
      branchId: user.defaultBranchId ?? null,
      accessTokenId: null,
      expiresAt: sessionExpiresAt,
      userAgent: 'erp-client',
      ipAddress: null,
      device: 'unknown',
      refreshTokenHash: this.tokenService ? this.tokenService.hashTokenValue(refreshToken) : 'internal-session-token',
    });

    const accessToken = this.tokenService ? this.tokenService.createAccessToken({
      userId: user.id,
      tenantId,
      sessionId: session.id,
      expiresInSeconds: 60 * 60,
    }) : undefined;

    return {
      success: true,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        organizationId: effectiveOrganizationId,
        activeLocationId: locationId ?? session.locationId ?? null,
        defaultBranchId: user.defaultBranchId,
        username: user.username,
        email: user.email,
        status: user.status,
      },
      session,
      accessToken,
      refreshToken: this.tokenService ? refreshToken : undefined,
    };
  }

  async getSession(sessionId: string, tenantId: string): Promise<SessionRecord | null> {
    return this.authenticationRepository.findSession(sessionId, tenantId);
  }

  async findSessionByRefreshTokenHash(tenantId: string, refreshTokenHash: string): Promise<SessionRecord | null> {
    return this.authenticationRepository.findSessionByRefreshTokenHash(tenantId, refreshTokenHash);
  }

  async validateSession(sessionId: string, tenantId: string): Promise<AuthenticatedUser | null> {
    const session = await this.authenticationRepository.findSession(sessionId, tenantId);
    if (!session || !session.isActive || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    const user = await this.authenticationRepository.findById(tenantId, session.userId);
    if (!user || user.status !== 'active') {
      return null;
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      organizationId: session.organizationId ?? null,
      activeLocationId: session.locationId ?? null,
      defaultBranchId: user.defaultBranchId,
      username: user.username,
      email: user.email,
      status: user.status,
    };
  }

  async invalidateSession(sessionId: string, tenantId: string): Promise<void> {
    await this.authenticationRepository.invalidateSession(sessionId, tenantId);
  }
}

export const createAuthenticatedUser = (user: { id: string; tenantId: string; organizationId?: string | null; defaultBranchId?: string | null; username: string; email: string; status: string }): AuthenticatedUser => ({
  ...user,
});

export const mapSessionRecord = (session: SessionRecord): SessionRecord => ({ ...session });
