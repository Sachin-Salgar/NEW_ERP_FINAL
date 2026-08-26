import { v7 as uuidV7 } from 'uuid';

import type { AuthenticatedUser, AuthenticationResult, SessionRecord } from '../../domain/contracts/authentication.js';
import type { AuthenticationRepository, PasswordHasher, TokenService } from '../contracts/security.js';

type MembershipResolver = {
  findUserOrganizationMemberships?: (tenantId: string, userId: string) => Promise<Array<{ id: string }>>;
};

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

    let sessionOrganizationId = user.organizationId ?? null;
    const membershipResolver = this.authenticationRepository as AuthenticationRepository & MembershipResolver;
    if (typeof membershipResolver.findUserOrganizationMemberships === 'function') {
      const memberships = await membershipResolver.findUserOrganizationMemberships(tenantId, user.id);
      if (memberships.length > 1) {
        sessionOrganizationId = null;
      } else if (memberships.length === 1) {
        sessionOrganizationId = memberships[0].id;
      }
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
      organizationId: sessionOrganizationId,
      locationId: null,
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
        organizationId: sessionOrganizationId,
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

    const session = await this.authenticationRepository.createSession({
      id: sessionId,
      tenantId,
      userId: user.id,
      organizationId: organizationId ?? null,
      locationId: locationId ?? null,
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
        organizationId: organizationId ?? null,
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
    if (!user) {
      return null;
    }

    if (user.status !== 'active') {
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