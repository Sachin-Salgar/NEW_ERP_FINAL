import type { AuthenticatedUser, AuthenticationResult, SessionRecord } from '../../domain/contracts/authentication.js';
import type { AuthenticationRepository, PasswordHasher } from '../contracts/security.js';

export class AuthenticationService {
  constructor(
    private readonly authenticationRepository: AuthenticationRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async authenticate(tenantId: string, identifier: string, password: string): Promise<AuthenticationResult> {
    const user = await this.authenticationRepository.findByTenantAndIdentifier(tenantId, identifier);

    if (!user) {
      return { success: false, reason: 'INVALID_CREDENTIALS' };
    }

    const validPassword = await this.passwordHasher.verify(password, user.passwordHash);
    if (!validPassword) {
      return { success: false, reason: 'INVALID_CREDENTIALS' };
    }

    const session = await this.authenticationRepository.createSession({
      tenantId,
      userId: user.id,
      organizationId: user.organizationId ?? null,
      branchId: user.defaultBranchId ?? null,
      accessTokenId: null,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8),
      userAgent: 'platform-bootstrap',
      ipAddress: null,
      device: 'web',
      refreshTokenHash: 'internal-session-token',
    });

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
    };
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
