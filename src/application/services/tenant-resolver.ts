import type { ResolvedTenant, TenantMembershipOrganization } from './tenant-resolution-service.js';

export interface TenantResolver {
  resolveTenantFromHost(host: string): Promise<ResolvedTenant>;
  resolveOnPremTenant(): Promise<ResolvedTenant>;
  resolveUserMemberships(
    tenantId: string,
    userId: string,
    requestedOrganizationId?: string | null,
  ): Promise<{
    organizations: TenantMembershipOrganization[];
    activeOrganizationId: string | null;
    requiresOrganizationSelection: boolean;
  }>;
}
