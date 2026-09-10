import { createHash, randomBytes } from 'node:crypto';
import { v7 as uuidV7 } from 'uuid';

import type { AuthenticationResult } from '../../domain/contracts/authentication.js';
import type {
  PendingLoginChallengeSnapshot,
  UnifiedLoginResult,
  UsableLoginContext,
  UsableLoginContexts,
} from '../../domain/contracts/unified-authentication.js';
import type { UnifiedAuthenticationRepository, PasswordHasher, TokenService } from '../contracts/security.js';
import type { AuthenticationService } from './authentication-service.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function challengeSecretHash(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

function descriptor(context: UsableLoginContext, contextRef: string) {
  return context.contextType === 'tenant'
    ? {
        type: 'tenant' as const,
        contextRef,
        label: context.tenantName,
      }
    : {
        type: 'platform' as const,
        contextRef,
        label: 'Platform administration',
      };
}

function contextSnapshot(context: UsableLoginContext, contextRef: string) {
  if (context.contextType === 'tenant') {
    return {
      contextId: context.contextId,
      contextType: context.contextType,
      identitySecurityVersion: context.identitySecurityVersion,
      membershipSecurityVersion: context.membershipSecurityVersion,
      tenantId: context.tenantId,
      tenantMembershipId: context.tenantMembershipId,
      tenantSecurityVersion: context.tenantSecurityVersion,
      contextRef,
    };
  }
  return {
    contextId: context.contextId,
    contextType: context.contextType,
    identitySecurityVersion: context.identitySecurityVersion,
    membershipSecurityVersion: context.membershipSecurityVersion,
    platformMembershipId: context.platformMembershipId,
    platformSecurityVersion: context.platformSecurityVersion,
    contextRef,
  };
}

function makeSnapshot(
  resolved: UsableLoginContexts,
  existingReferences?: PendingLoginChallengeSnapshot['contexts'],
): {
  snapshot: PendingLoginChallengeSnapshot;
  descriptors: UnifiedLoginResult['contexts'];
} {
  const offered = resolved.contexts.map((context) => {
    const existing = existingReferences?.find(
      (reference) =>
        reference.contextType === context.contextType && reference.contextId === context.contextId,
    );
    return {
      context,
      contextRef: existing?.contextRef ?? randomBytes(24).toString('base64url'),
    };
  });
  return {
    snapshot: stableValue({
      contexts: offered.map(({ context, contextRef }) => contextSnapshot(context, contextRef)),
      identitySecurityVersion: resolved.identitySecurityVersion,
    }) as PendingLoginChallengeSnapshot,
    descriptors: offered.map(({ context, contextRef }) => descriptor(context, contextRef)),
  };
}

function splitChallengeToken(token: string): { challengeId: string; secret: string } | null {
  const match = /^([0-9a-f]{8}-[0-9a-f-]{27})\.([A-Za-z0-9_-]{40,})$/i.exec(token.trim());
  return match ? { challengeId: match[1], secret: match[2] } : null;
}

export class UnifiedAuthenticationService {
  constructor(
    private readonly repository: UnifiedAuthenticationRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
    private readonly tenantAuthenticationService: AuthenticationService,
    private readonly lockoutOptions: { maxFailedAttempts?: number; lockoutMinutes?: number } = {},
  ) {}

  private async issuePlatformContext(
    context: Extract<UsableLoginContext, { contextType: 'platform' }>,
  ): Promise<AuthenticationResult> {
    const sessionId = uuidV7();
    const refreshToken = this.tokenService.createRefreshToken({
      userId: context.identityId,
      identityId: context.identityId,
      tenantId: null,
      sessionId,
      contextType: 'platform',
      membershipId: context.platformMembershipId,
      expiresInSeconds: 60 * 60 * 24 * 14,
    });
    const session = await this.repository.createPlatformSession({
      id: sessionId,
      identityId: context.identityId,
      platformMembershipId: context.platformMembershipId,
      refreshTokenHash: this.tokenService.hashTokenValue(refreshToken),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8),
      securityVersion: context.membershipSecurityVersion,
    });
    const accessToken = this.tokenService.createAccessToken({
      userId: context.identityId,
      identityId: context.identityId,
      tenantId: null,
      sessionId,
      contextType: 'platform',
      membershipId: context.platformMembershipId,
      expiresInSeconds: 60 * 60,
    });
    return {
      success: true,
      session,
      accessToken,
      refreshToken,
      user: undefined,
    } as AuthenticationResult;
  }

  private async issueContext(
    context: UsableLoginContext,
  ): Promise<{ context: UsableLoginContext; authentication: AuthenticationResult } | null> {
    if (context.contextType === 'tenant') {
      const authorized = await this.repository.authorizeTenantLoginContext(
        context.identityId,
        context.tenantMembershipId,
        context.tenantId,
      );
      if (!authorized) return null;
      return {
        context: authorized,
        authentication: await this.tenantAuthenticationService.authenticateTenantContext(authorized),
      };
    }
    const authorized = await this.repository.authorizePlatformLoginContext(
      context.identityId,
      context.platformMembershipId,
    );
    if (!authorized) return null;
    return { context: authorized, authentication: await this.issuePlatformContext(authorized) };
  }

  async authenticate(identifier: string, password: string): Promise<UnifiedLoginResult> {
    const credential = await this.repository.findLoginIdentity(identifier.trim());
    if (!credential) return { resolution: 'ZERO' };
    if (credential.lockedUntil && credential.lockedUntil.getTime() > Date.now()) {
      const lockedContexts = await this.repository.resolveUsableLoginContexts(credential.identityId);
      const lockedTenant = lockedContexts.contexts.find((context) => context.contextType === 'tenant');
      return {
        resolution: 'ZERO',
        failureTenantId: lockedTenant?.tenantId,
      };
    }

    const validPassword = await this.passwordHasher.verify(password, credential.secretHash);
    if (!validPassword) {
      const failedState = await this.repository.recordFailedIdentityLogin?.(credential.identityId, this.lockoutOptions);
      const failedContexts = await this.repository.resolveUsableLoginContexts(credential.identityId);
      const failedTenant = failedContexts.contexts.find((context) => context.contextType === 'tenant');
      return {
        resolution: 'ZERO',
        failureTenantId: failedTenant?.tenantId,
        reason: failedState?.lockedUntil && failedState.lockedUntil.getTime() > Date.now() ? 'ACCOUNT_LOCKED' : undefined,
      } as UnifiedLoginResult & { reason?: string };
    }
    await this.repository.resetFailedIdentityLogin?.(credential.identityId);

    const resolved = await this.repository.resolveUsableLoginContexts(credential.identityId);
    if (resolved.contexts.length === 0) return { resolution: 'ZERO' };
    if (resolved.contexts.length === 1) {
      const issued = await this.issueContext(resolved.contexts[0]);
      if (!issued) return { resolution: 'ZERO' };
      return {
        resolution: 'DIRECT',
        context: issued.context,
        authentication: issued.authentication,
      };
    }

    const challengeId = uuidV7();
    const secret = randomBytes(32).toString('base64url');
    const offered = makeSnapshot(resolved);
    await this.repository.createPendingLoginChallenge({
      challengeId,
      identityId: credential.identityId,
      secretHash: challengeSecretHash(secret),
      contextSnapshot: offered.snapshot,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    });
    return {
      resolution: 'SELECT',
      contexts: offered.descriptors,
      pendingSelectionToken: `${challengeId}.${secret}`,
    };
  }

  async selectContext(
    pendingSelectionToken: string,
    contextRef: string,
  ): Promise<UnifiedLoginResult> {
    const parsed = splitChallengeToken(pendingSelectionToken);
    if (!parsed) return { resolution: 'ZERO' };
    const consumed = await this.repository.consumePendingLoginChallenge(
      parsed.challengeId,
      challengeSecretHash(parsed.secret),
    );
    if (!consumed) return { resolution: 'ZERO' };

    if (!/^[A-Za-z0-9_-]{32,}$/.test(contextRef)) return { resolution: 'ZERO' };
    const resolved = await this.repository.resolveUsableLoginContexts(consumed.identityId);
    const offeredContext = consumed.contextSnapshot.contexts.find((context) => context.contextRef === contextRef);
    if (!offeredContext) return { resolution: 'ZERO' };
    const selected = resolved.contexts.find(
      (context) =>
        context.contextType === offeredContext.contextType && context.contextId === offeredContext.contextId,
    );
    if (
      !selected ||
      stableJson(makeSnapshot(resolved, consumed.contextSnapshot.contexts).snapshot) !==
        stableJson(consumed.contextSnapshot)
    ) {
      return { resolution: 'ZERO' };
    }
    const issued = await this.issueContext(selected);
    if (!issued) return { resolution: 'ZERO' };
    return {
      resolution: 'DIRECT',
      context: issued.context,
      authentication: issued.authentication,
    };
  }
}
