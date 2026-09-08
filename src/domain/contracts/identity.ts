export type IdentityProvider = 'local' | 'ldap' | 'active-directory' | 'oauth' | 'oidc' | 'saml' | 'unknown';

export interface IdentityRecord {
  [key: string]: any;
  id: string;
  provider: IdentityProvider;
  providerSubject: string;
  tenantId?: string | null;
  email?: string | null;
  isVerified: boolean;
  userId?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export interface EffectiveSessionContext {
  [key: string]: any;
  identityId: string;
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  sessionId?: string | null;
  authenticatedAt: Date | string;
}
