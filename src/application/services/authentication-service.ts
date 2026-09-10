import { v7 as uuidV7 } from 'uuid';

import type { AuthenticatedUser, AuthenticationResult, SessionRecord } from '../../domain/contracts/authentication.js';
import type { AuthenticationRepository, PasswordHasher, TokenService } from '../contracts/security.js';
import type { AuthorizedTenantLoginContext } from '../../domain/contracts/unified-authentication.js';

export interface AuthenticationLockoutOptions {
  maxFailedAttempts?: number;
  lockoutMinutes?: number;
}

export class AuthenticationService {
  private readonly maxFailedAttempts: number;
  private readonly lockoutMinutes: number;

  constructor(
    private readonly authenticationRepository: AuthenticationRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService?: TokenService,
    options: AuthenticationLockoutOptions = {},
  ) {
    this.maxFailedAttempts = options.maxFailedAttempts ?? 5;
    this.lockoutMinutes = options.lockoutMinutes ?? 15;
  }

  private isUserLocked(user: { lockedUntil?: Date | string | null }): boolean {
    if (!user.lockedUntil) {
      return false;
    }

    const lockedUntil = user.lockedUntil instanceof Date ? user.lockedUntil : new Date(user.lockedUntil);
    return Number.isFinite(lockedUntil.getTime()) && lockedUntil.getTime() > Date.now();
  }

  private async handleFailedAuthentication(
    tenantId: string,
    userId: string,
  ): Promise<{
    success: false;
    reason: string;
    retryAfterSeconds?: number;
    failureTenantId: string;
    failureUserId: string;
  } | null> {
    if (!this.authenticationRepository.recordFailedLoginAttempt) {
      return { success: false, reason: 'INVALID_CREDENTIALS', failureTenantId: tenantId, failureUserId: userId };
    }

    const state = await this.authenticationRepository.recordFailedLoginAttempt(tenantId, userId, {
      maxFailedAttempts: this.maxFailedAttempts,
      lockoutMinutes: this.lockoutMinutes,
    });
    const failedLoginCount = state.failedLoginCount ?? 0;
    const lockedUntil = state.lockedUntil ? new Date(state.lockedUntil) : null;

    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      const retryAfterSeconds = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
      return {
        success: false,
        reason: 'ACCOUNT_LOCKED',
        retryAfterSeconds,
        failureTenantId: tenantId,
        failureUserId: userId,
      };
    }

    if (failedLoginCount >= this.maxFailedAttempts) {
      const retryAfterSeconds = this.lockoutMinutes * 60;
      return {
        success: false,
        reason: 'ACCOUNT_LOCKED',
        retryAfterSeconds,
        failureTenantId: tenantId,
        failureUserId: userId,
      };
    }

    return { success: false, reason: 'INVALID_CREDENTIALS', failureTenantId: tenantId, failureUserId: userId };
  }

  async authenticate(identifier: string, password: string): Promise<AuthenticationResult> {
    let matchedUser: Awaited<ReturnType<AuthenticationRepository['findById']>> = null;
    let matchedTenantId: string | null = null;

    const candidates = await this.authenticationRepository.findLoginCandidates(identifier);
    if (candidates.length === 0) {
      return { success: false, reason: 'INVALID_CREDENTIALS' };
    }

    const uniqueCandidates = [
      ...new Map(candidates.map((candidate) => [`${candidate.tenantId}:${candidate.userId}`, candidate])).values(),
    ];

    for (const candidate of uniqueCandidates) {
      if (!candidate.tenantId || !candidate.userId) {
        continue;
      }

      const user = await this.authenticationRepository.findById(candidate.tenantId, candidate.userId);
      if (!user || user.status !== 'active') {
        continue;
      }

      if (this.isUserLocked(user)) {
        return { success: false, reason: 'ACCOUNT_LOCKED' };
      }

      const validPassword = await this.passwordHasher.verify(password, user.passwordHash);
      if (!validPassword) {
        const failedResult = await this.handleFailedAuthentication(candidate.tenantId, user.id);
        if (failedResult) {
          return failedResult;
        }
        continue;
      }

      if (this.authenticationRepository.resetFailedLoginState) {
        await this.authenticationRepository.resetFailedLoginState(candidate.tenantId, user.id);
      }

      if (matchedUser) {
        return { success: false, reason: 'INVALID_CREDENTIALS' };
      }

      matchedUser = user;
      matchedTenantId = candidate.tenantId;
    }

    if (!matchedUser || !matchedTenantId) {
      return { success: false, reason: 'INVALID_CREDENTIALS' };
    }

    const user = matchedUser!;
    const resolvedTenantId = matchedTenantId!;
    const sessionId = uuidV7();
    const sessionExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 8);
    const refreshToken = this.tokenService
      ? this.tokenService.createRefreshToken({
          userId: user.id,
          identityId: user.identityId,
          tenantId: resolvedTenantId,
          sessionId,
          expiresInSeconds: 60 * 60 * 24 * 14,
        })
      : 'internal-session-token';

    const branchAuthorized = user.defaultBranchId
      ? this.authenticationRepository.validateBranchAccess
        ? await this.authenticationRepository.validateBranchAccess(resolvedTenantId, user.id, user.defaultBranchId)
        : true
      : false;
    const branchId = branchAuthorized ? user.defaultBranchId ?? null : null;
    const session = await this.authenticationRepository.createSession({
      id: sessionId,
      tenantId: resolvedTenantId,
      userId: user.id,
      identityId: user.identityId,
      branchId,
      accessTokenId: null,
      expiresAt: sessionExpiresAt,
      userAgent: 'erp-client',
      ipAddress: null,
      device: 'unknown',
      refreshTokenHash: this.tokenService ? this.tokenService.hashTokenValue(refreshToken) : 'internal-session-token',
    });

    const accessToken = this.tokenService
      ? this.tokenService.createAccessToken({
          userId: user.id,
          identityId: user.identityId,
          tenantId: resolvedTenantId,
          sessionId: session.id,
          expiresInSeconds: 60 * 60,
        })
      : undefined;

    return {
      success: true,
      user: {
        id: user.id,
        identityId: user.identityId,
        tenantId: user.tenantId,
        branchId: session.branchId ?? null,
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

  async authenticateTenantContext(context: AuthorizedTenantLoginContext): Promise<AuthenticationResult> {
    const user = context.user;
    const tenantId = context.tenantId;
    const sessionId = uuidV7();
    const sessionExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 8);
    const refreshToken = this.tokenService
      ? this.tokenService.createRefreshToken({
          userId: user.id,
          identityId: context.user.identityId,
          tenantId,
          sessionId,
          contextType: 'tenant',
          membershipId: context.tenantMembershipId,
          expiresInSeconds: 60 * 60 * 24 * 14,
        })
      : 'internal-session-token';

    const branchAuthorized = user.defaultBranchId
      ? this.authenticationRepository.validateBranchAccess
        ? await this.authenticationRepository.validateBranchAccess(tenantId, user.id, user.defaultBranchId)
        : true
      : false;
    const session = await this.authenticationRepository.createSession({
      id: sessionId,
      tenantId,
      userId: user.id,
      identityId: context.user.identityId,
      tenantMembershipId: context.tenantMembershipId,
      contextType: 'tenant',
      securityVersion: context.membershipSecurityVersion,
      branchId: branchAuthorized ? user.defaultBranchId ?? null : null,
      accessTokenId: null,
      expiresAt: sessionExpiresAt,
      userAgent: 'erp-client',
      ipAddress: null,
      device: 'unknown',
      refreshTokenHash: this.tokenService ? this.tokenService.hashTokenValue(refreshToken) : 'internal-session-token',
    });
    const accessToken = this.tokenService
      ? this.tokenService.createAccessToken({
          userId: user.id,
          identityId: context.user.identityId,
          tenantId,
          sessionId: session.id,
          contextType: 'tenant',
          membershipId: context.tenantMembershipId,
          expiresInSeconds: 60 * 60,
        })
      : undefined;

    return {
      success: true,
      user: {
        id: user.id,
        identityId: context.user.identityId,
        tenantId,
        branchId: session.branchId ?? null,
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

  async updateBranchContext(
    sessionId: string,
    tenantId: string,
    userId: string,
    branchId: string,
    financialYearId: string,
  ): Promise<SessionRecord | null> {
    if (!this.authenticationRepository.validateBranchAccess ||
        !(await this.authenticationRepository.validateBranchAccess(tenantId, userId, branchId))) {
      return null;
    }
    return this.authenticationRepository.updateSessionContext(sessionId, tenantId, userId, branchId, financialYearId);
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
      branchId: session.branchId ?? null,
      defaultBranchId: user.defaultBranchId,
      financialYearId: session.financialYearId ?? null,
      username: user.username,
      email: user.email,
      status: user.status,
    };
  }

  async invalidateSession(sessionId: string, tenantId: string): Promise<void> {
    await this.authenticationRepository.invalidateSession(sessionId, tenantId);
  }
}

export const createAuthenticatedUser = (user: {
  id: string;
  tenantId: string;
  defaultBranchId?: string | null;
  username: string;
  email: string;
  status: string;
}): AuthenticatedUser => ({
  ...user,
});

export const mapSessionRecord = (session: SessionRecord): SessionRecord => ({ ...session });
