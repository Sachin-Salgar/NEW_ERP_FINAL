export type IdentityProvider = 'local' | 'ldap' | 'active-directory' | 'oauth' | 'oidc' | 'saml' | 'unknown';

export interface IdentityRecord {
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

export interface OrganizationMembershipRecord {
  id: string;
  tenantId: string;
  userId: string;
  organizationId: string;
  isPrimary?: boolean;
  roleIds?: string[];
  permissionKeys?: string[];
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export interface UserLocationAccessRecord {
  id: string;
  tenantId: string;
  userId: string;
  organizationId: string;
  locationId: string;
  isActive: boolean;
  grantedBy?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export interface ActiveOrganizationContext {
  tenantId: string;
  userId: string;
  organizationId: string;
  isValidated: boolean;
  validatedAt?: Date | string | null;
}

export interface ActiveLocationContext {
  tenantId: string;
  userId: string;
  organizationId: string;
  locationId: string;
  isValidated: boolean;
  validatedAt?: Date | string | null;
}

export interface EffectiveSessionContext {
  identityId: string;
  userId: string;
  tenantId: string;
  organizationId?: string | null;
  activeOrganizationId?: string | null;
  activeLocationId?: string | null;
  roles: string[];
  permissions: string[];
  locationAccess: string[];
  sessionId?: string | null;
  authenticatedAt: Date | string;
}
