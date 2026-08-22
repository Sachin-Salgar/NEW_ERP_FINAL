import { ForbiddenError, ValidationError } from '../../domain/errors.js';

export interface ResolvedTenant {
  id: string;
  name: string;
  displayName?: string | null;
  subdomain: string;
  slug: string;
  status: string;
  mode?: 'saas' | 'on-prem';
}

export interface TenantMembershipOrganization {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  status: 'active' | 'inactive' | 'archived';
  isDefault: boolean;
}

export interface TenantResolutionRepository {
  getTenantById(tenantId: string): Promise<ResolvedTenant | null>;
  findTenantByHost(host: string): Promise<ResolvedTenant | null>;
  findUserOrganizationMemberships(tenantId: string, userId: string): Promise<TenantMembershipOrganization[]>;
}

export class TenantResolutionService {
  constructor(
    private readonly repository: TenantResolutionRepository,
    private readonly deploymentConfig: { TENANT_HOST_MAP?: string; DEPLOYMENT_TENANT_ID?: string; NODE_ENV?: string } = {},
  ) {}

  private normalizeHost(host: string): string {
    const normalized = (host ?? '').trim().toLowerCase();
    if (!normalized) {
      throw new ValidationError('Deployment host is required.');
    }

    return normalized.replace(/:\d+$/, '').replace(/^www\./, '');
  }

  private parseHostMap(): Record<string, string> {
    const raw = this.deploymentConfig.TENANT_HOST_MAP ?? '';
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      return Object.fromEntries(
        Object.entries(parsed).map(([host, tenantId]) => [this.normalizeHost(host), String(tenantId)]),
      );
    } catch {
      return {};
    }
  }

  private getDeploymentMode(): 'saas' | 'on-prem' {
    return this.deploymentConfig.DEPLOYMENT_TENANT_ID ? 'on-prem' : 'saas';
  }

  async resolveTenantFromHost(host: string): Promise<ResolvedTenant> {
    const normalizedHost = this.normalizeHost(host);
    const hostMap = this.parseHostMap();

    if (hostMap[normalizedHost]) {
      const resolved = await this.repository.getTenantById(hostMap[normalizedHost]);
      if (!resolved) {
        throw new ValidationError(`Tenant mapping for host "${normalizedHost}" does not resolve to a valid tenant.`);
      }
      return { ...resolved, mode: this.getDeploymentMode() };
    }

    const tenant = await this.repository.findTenantByHost(normalizedHost);
    if (!tenant) {
      throw new ValidationError(`No tenant configuration exists for host "${normalizedHost}".`);
    }

    return { ...tenant, mode: this.getDeploymentMode() };
  }

  async resolveOnPremTenant(): Promise<ResolvedTenant> {
    const tenantId = (this.deploymentConfig.DEPLOYMENT_TENANT_ID ?? '').trim();
    if (!tenantId) {
      throw new ValidationError('On-prem tenant configuration is missing.');
    }

    const tenant = await this.repository.getTenantById(tenantId);
    if (!tenant) {
      throw new ValidationError('The configured on-prem tenant does not exist.');
    }

    return { ...tenant, mode: 'on-prem' };
  }

  async resolveUserMemberships(tenantId: string, userId: string, requestedOrganizationId?: string | null): Promise<{
    organizations: TenantMembershipOrganization[];
    activeOrganizationId: string | null;
    requiresOrganizationSelection: boolean;
  }> {
    const trimmedTenantId = tenantId?.trim();
    const trimmedUserId = userId?.trim();

    if (!trimmedTenantId || !trimmedUserId) {
      throw new ValidationError('Tenant and user identifiers are required to resolve organization membership.');
    }

    const organizations = await this.repository.findUserOrganizationMemberships(trimmedTenantId, trimmedUserId);
    if (organizations.length === 0) {
      throw new ForbiddenError('User does not have any organization membership in the resolved tenant.');
    }

    const requested = requestedOrganizationId?.trim();
    if (requested) {
      const selected = organizations.find((organization) => organization.id === requested);
      if (!selected) {
        throw new ForbiddenError('Requested organization is not available for this user in the current tenant.');
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
