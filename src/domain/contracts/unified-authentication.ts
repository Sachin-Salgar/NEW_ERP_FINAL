import type { AuthenticationContextType, AuthenticationResult } from './authentication.js';

export interface TenantLoginContext {
  contextType: 'tenant';
  contextId: string;
  tenantMembershipId: string;
  tenantId: string;
  tenantName: string;
  identityId: string;
  userId: string;
  identitySecurityVersion: number;
  membershipSecurityVersion: number;
  tenantSecurityVersion: number;
  userSecurityVersion: number;
}

export interface AuthorizedTenantLoginContext extends TenantLoginContext {
  userId: string;
  user: {
    id: string;
    identityId?: string;
    tenantId: string;
    defaultBranchId?: string | null;
    username: string;
    email: string;
    status: string;
  };
  userSecurityVersion: number;
}

export interface PlatformLoginContext {
  contextType: 'platform';
  contextId: string;
  identityId: string;
  platformMembershipId: string;
  identitySecurityVersion: number;
  membershipSecurityVersion: number;
  platformSecurityVersion: number;
}

export type UsableLoginContext = TenantLoginContext | PlatformLoginContext;

export interface UsableLoginContexts {
  identityId: string;
  identitySecurityVersion: number;
  contexts: UsableLoginContext[];
}

export interface LoginIdentityCredential {
  identityId: string;
  identitySecurityVersion: number;
  secretHash: string;
  failedAttemptCount: number;
  lockedUntil: Date | null;
}

export interface PendingLoginChallengeSnapshot {
  contexts: Array<{
    contextId: string;
    contextType: AuthenticationContextType;
    platformMembershipId?: string;
    tenantMembershipId?: string;
    tenantId?: string;
    userId?: string;
    identitySecurityVersion: number;
    membershipSecurityVersion: number;
    tenantSecurityVersion?: number;
    userSecurityVersion?: number;
    contextRef: string;
    [key: string]: string | number | undefined;
  }>;
  identitySecurityVersion: number;
}

export interface PendingLoginChallenge {
  challengeId: string;
  identityId: string;
  secretHash: string;
  contextSnapshot: PendingLoginChallengeSnapshot;
  expiresAt: Date;
}

export interface UnifiedLoginResult {
  resolution: 'DIRECT' | 'SELECT' | 'ZERO';
  reason?: string;
  failureTenantId?: string;
  failureUserId?: string;
  context?: UsableLoginContext;
  authentication?: AuthenticationResult;
  contexts?: Array<{
    type: AuthenticationContextType;
    contextRef: string;
    label: string;
  }>;
  pendingSelectionToken?: string;
}

export function compareUsableLoginContexts(left: UsableLoginContext, right: UsableLoginContext): number {
  const leftKey = `${left.contextType}:${left.contextId}`;
  const rightKey = `${right.contextType}:${right.contextId}`;
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}
