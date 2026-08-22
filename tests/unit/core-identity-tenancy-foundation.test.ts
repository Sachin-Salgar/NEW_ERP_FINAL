import { describe, expect, it } from 'vitest';
import { v7 } from 'uuid';

import type {
  ActiveLocationContext,
  ActiveOrganizationContext,
  EffectiveSessionContext,
  IdentityRecord,
  OrganizationMembershipRecord,
  UserLocationAccessRecord,
} from '../../src/domain/contracts/identity.js';
import type { TenantContext } from '../../src/domain/contracts/tenant-context.js';

describe('Core identity and tenancy foundation', () => {
  it('keeps identity separate from user and tenant metadata', () => {
    const identity: IdentityRecord = {
      id: v7(),
      provider: 'local',
      providerSubject: 'user-123',
      tenantId: v7(),
      email: 'ops@example.com',
      isVerified: true,
      userId: v7(),
    };

    const membership: OrganizationMembershipRecord = {
      id: v7(),
      tenantId: identity.tenantId as string,
      userId: identity.userId as string,
      organizationId: v7(),
      roleIds: [v7(), v7()],
      permissionKeys: ['tenant:view', 'organization:read'],
      isPrimary: true,
    };

    const locationAccess: UserLocationAccessRecord = {
      id: v7(),
      tenantId: identity.tenantId as string,
      userId: identity.userId as string,
      organizationId: membership.organizationId,
      locationId: v7(),
      isActive: true,
      grantedBy: 'system',
    };

    expect(identity.userId).not.toBe(identity.id);
    expect(membership.tenantId).toBe(identity.tenantId);
    expect(locationAccess.organizationId).toBe(membership.organizationId);
  });

  it('supports the active organization and active location context contract', () => {
    const tenantId = v7();
    const userId = v7();
    const organizationId = v7();
    const locationId = v7();

    const activeOrganization: ActiveOrganizationContext = {
      tenantId,
      userId,
      organizationId,
      isValidated: true,
      validatedAt: new Date().toISOString(),
    };

    const activeLocation: ActiveLocationContext = {
      tenantId,
      userId,
      organizationId,
      locationId,
      isValidated: true,
      validatedAt: new Date().toISOString(),
    };

    expect(activeOrganization.organizationId).toBe(organizationId);
    expect(activeLocation.locationId).toBe(locationId);
  });

  it('allows tenant context to carry effective session metadata without replacing the tenant boundary', () => {
    const tenantId = v7();
    const userId = v7();
    const organizationId = v7();
    const locationId = v7();

    const tenantContext: TenantContext = {
      tenantId,
      identityId: v7(),
      userId,
      organizationId,
      activeOrganizationId: organizationId,
      activeLocationId: locationId,
      roleIds: ['admin', 'ops-manager'],
      permissionKeys: ['tenant:view', 'location:read'],
      locationAccess: [locationId],
      sessionId: 'session-1',
      resolvedAt: new Date().toISOString(),
    };

    const effectiveSession: EffectiveSessionContext = {
      identityId: tenantContext.identityId as string,
      userId,
      tenantId,
      organizationId,
      activeOrganizationId: organizationId,
      activeLocationId: locationId,
      roles: tenantContext.roleIds as string[],
      permissions: tenantContext.permissionKeys as string[],
      locationAccess: tenantContext.locationAccess as string[],
      sessionId: tenantContext.sessionId,
      authenticatedAt: tenantContext.resolvedAt as string,
    };

    expect(tenantContext.tenantId).toBe(tenantId);
    expect(effectiveSession.activeLocationId).toBe(locationId);
    expect(effectiveSession.roles).toContain('admin');
  });
});
