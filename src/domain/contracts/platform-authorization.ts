export interface PlatformContext {
  sessionId: string;
  identityId: string;
  platformMembershipId: string;
}

export interface PlatformTenantRecord {
  id: string;
  name: string;
  displayName: string | null;
  subdomain: string;
  slug: string;
  timezone: string;
  currency: string;
  locale: string;
  status: string;
  createdAt: Date;
  updatedAt: Date | null;
  isDeleted: boolean;
}

export interface PlatformAuthorizationRepository {
  validateContext(sessionId: string, identityId: string): Promise<PlatformContext | null>;
  hasPermission(platformMembershipId: string, permissionKey: string): Promise<boolean>;
  listTenants(): Promise<PlatformTenantRecord[]>;
}
