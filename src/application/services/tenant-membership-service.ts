import { ForbiddenError, ValidationError } from '../../domain/errors.js';

export interface TenantMembershipRepository {
  findUserOrganizationMemberships(tenantId: string, userId: string): Promise<Array<{
    id: string;
    tenantId: string;
    code: string;
    name: string;
    status: 'active' | 'inactive' | 'archived';
    isDefault: boolean;
  }>>;
}

export class TenantMembershipService {
  constructor(private readonly repository: TenantMembershipRepository) {}

  async resolveOrganizationMemberships(tenantId: string, userId: string, requestedOrganizationId?: string | null) {
    const organizations = await this.repository.findUserOrganizationMemberships(tenantId.trim(), userId.trim());
    if (organizations.length === 0) {
      throw new ForbiddenError('User does not have any organization membership in the active tenant.');
    }

    const requested = requestedOrganizationId?.trim();
    if (requested) {
      const selected = organizations.find((organization) => organization.id === requested);
      if (!selected) {
        throw new ForbiddenError('Requested organization is not available for this user in the active tenant.');
      }
      return {
        organizations,
        activeOrganizationId: selected.id,
        requiresOrganizationSelection: false,
      };
    }

    if (organizations.length === 1) {
      return {
        organizations,
        activeOrganizationId: organizations[0].id,
        requiresOrganizationSelection: false,
      };
    }

    return {
      organizations,
      activeOrganizationId: null,
      requiresOrganizationSelection: true,
    };
  }
}
