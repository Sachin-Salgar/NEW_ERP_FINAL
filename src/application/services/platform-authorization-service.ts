import type {
  PlatformContext,
  PlatformTenantRecord,
} from '../../domain/contracts/platform-authorization.js';

export class PlatformAuthorizationService {
  constructor(private readonly repository: any) {}

  validateContext(sessionId: string, identityId: string): Promise<PlatformContext | null> {
    return this.repository.validateContext(sessionId, identityId);
  }

  hasPermission(platformMembershipId: string, permissionKey: string): Promise<boolean> {
    return this.repository.hasPermission(platformMembershipId, permissionKey);
  }

  listTenants(): Promise<PlatformTenantRecord[]> {
    return this.repository.listTenants();
  }
}
