import { v7 as uuidV7 } from 'uuid';

import type { AuthenticatedUser, AuthenticationResult, SessionRecord } from '../../domain/contracts/authentication.js';
import type { AuthenticationRepository, PasswordHasher, TokenService } from '../contracts/security.js';

export class AuthenticationService {
  constructor(
    private readonly authenticationRepository: AuthenticationRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService?: TokenService,
  ) {}

  async authenticate(tenantId: string, identifier: string, password: string): Promise<AuthenticationResult> {
    const user = await this.authenticationRepository.findByTenantAndIdentifier(tenantId, identifier);

    if (!user) {
      return { success: false, reason: 'INVALID_CREDENTIALS' };
    }

    if (user.status !== 'active') {
      return { success: false, reason: 'USER_INACTIVE' };
    }

    const validPassword = await this.passwordHasher.verify(password, user.passwordHash);
    if (!validPassword) {
      return { success: false, reason: 'INVALID_CREDENTIALS' };
    }

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
      branchId: user.defaultBranchId ?? null,
      accessTokenId: null,
      expiresAt: sessionExpiresAt,
      userAgent: 'platform-bootstrap',
      ipAddress: null,
      device: 'web',
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
    if (!user) {
      return null;
    }

    if (user.status !== 'active') {
      return null;
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      organizationId: user.organizationId,
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
