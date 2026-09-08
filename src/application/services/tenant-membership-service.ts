import { ForbiddenError } from '../../domain/errors.js';

export interface TenantMembershipRepository {
  findUserOrganizationMemberships(
    tenantId: string,
    userId: string,
  ): Promise<
    Array<{
      id: string;
      tenantId: string;
      code: string;
      name: string;
      status: 'active' | 'inactive' | 'archived';
      isDefault: boolean;
    }>
  >;
}

export class TenantMembershipService {
  constructor(private readonly repository: any) {}

  async resolveOrganizationMemberships(tenantId: string, userId: string) {
    const normalizedTenantId = tenantId.trim();
    const normalizedUserId = userId.trim();
    if (!normalizedTenantId || !normalizedUserId) {
      throw new ForbiddenError('Authenticated tenant and user context are required.');
    }

    const organizations = await this.repository.findUserOrganizationMemberships(normalizedTenantId, normalizedUserId);
    if (organizations.length === 0) {
      throw new ForbiddenError('User does not have any organization membership in the active tenant.');
    }

    return { organizations };
  }
}
