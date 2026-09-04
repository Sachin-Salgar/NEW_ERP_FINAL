import { ValidationError } from '../../domain/errors.js';
import type {
  BranchRecord,
  CoreEnterpriseRepository,
  OrganizationRecord,
  UserAdminRecord,
  UserBranchAccessRecord,
  UserOrganizationAccessRecord,
} from '../../domain/contracts/repositories.js';

export class CoreEnterpriseService {
  constructor(private readonly repository: CoreEnterpriseRepository) {}

  private ensureTenantContext(tenantId: string): void {
    if (!tenantId || !tenantId.trim()) {
      throw new ValidationError('Tenant context is required.');
    }
  }

  private normalizeCode(value: string | null | undefined, field: string): string {
    const normalized = value?.trim();
    if (!normalized) {
      throw new ValidationError(`${field} is required.`);
    }
    return normalized;
  }

  private normalizeName(value: string | null | undefined, field: string): string {
    const normalized = value?.trim();
    if (!normalized) {
      throw new ValidationError(`${field} is required.`);
    }
    return normalized;
  }

  async createOrganization(
    tenantId: string,
    input: Partial<
      Pick<
        OrganizationRecord,
        | 'code'
        | 'name'
        | 'legalName'
        | 'gstNo'
        | 'panNo'
        | 'cinNo'
        | 'email'
        | 'phone'
        | 'website'
        | 'baseCurrency'
        | 'fiscalCalendar'
        | 'status'
        | 'isDefault'
        | 'remarks'
      >
    >,
  ): Promise<OrganizationRecord> {
    this.ensureTenantContext(tenantId);
    const name = this.normalizeName(input.name ?? null, 'Organization name');
    return this.repository.createOrganization(tenantId, {
      code: input.code ?? undefined,
      name,
      legalName: input.legalName ?? null,
      gstNo: input.gstNo ?? null,
      panNo: input.panNo ?? null,
      cinNo: input.cinNo ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      website: input.website ?? null,
      baseCurrency: input.baseCurrency ?? 'USD',
      fiscalCalendar: input.fiscalCalendar ?? 'standard',
      status: input.status ?? 'active',
      isDefault: input.isDefault ?? false,
      remarks: input.remarks ?? null,
    });
  }

  async listOrganizations(tenantId: string): Promise<OrganizationRecord[]> {
    this.ensureTenantContext(tenantId);
    return this.repository.listOrganizations(tenantId);
  }

  async getOrganization(tenantId: string, organizationId: string): Promise<OrganizationRecord | null> {
    this.ensureTenantContext(tenantId);
    if (!organizationId || !organizationId.trim()) throw new ValidationError('Organization ID is required.');
    return this.repository.getOrganizationById(tenantId, organizationId.trim());
  }

  async updateOrganization(
    tenantId: string,
    organizationId: string,
    changes: Partial<
      Pick<
        OrganizationRecord,
        | 'code'
        | 'name'
        | 'legalName'
        | 'gstNo'
        | 'panNo'
        | 'cinNo'
        | 'email'
        | 'phone'
        | 'website'
        | 'baseCurrency'
        | 'fiscalCalendar'
        | 'status'
        | 'isDefault'
        | 'remarks'
      >
    >,
  ): Promise<OrganizationRecord | null> {
    this.ensureTenantContext(tenantId);
    if (!organizationId || !organizationId.trim()) throw new ValidationError('Organization ID is required.');
    const payload: Record<string, unknown> = { ...changes };
    if (typeof payload.code === 'string')
      throw new ValidationError('Organization code is generated server-side and cannot be modified.');
    if (typeof payload.name === 'string') payload.name = this.normalizeName(payload.name, 'Organization name');
    return this.repository.updateOrganization(
      tenantId,
      organizationId.trim(),
      payload as Partial<
        Pick<
          OrganizationRecord,
          | 'code'
          | 'name'
          | 'legalName'
          | 'gstNo'
          | 'panNo'
          | 'cinNo'
          | 'email'
          | 'phone'
          | 'website'
          | 'baseCurrency'
          | 'fiscalCalendar'
          | 'status'
          | 'isDefault'
          | 'remarks'
        >
      >,
    );
  }

  async deactivateOrganization(tenantId: string, organizationId: string): Promise<boolean> {
    this.ensureTenantContext(tenantId);
    if (!organizationId || !organizationId.trim()) throw new ValidationError('Organization ID is required.');
    return this.repository.deactivateOrganization(tenantId, organizationId.trim());
  }

  async createBranch(
    tenantId: string,
    organizationId: string,
    input: Partial<
      Pick<
        BranchRecord,
        | 'code'
        | 'name'
        | 'status'
        | 'isHeadOffice'
        | 'isDefault'
        | 'addressLine1'
        | 'addressLine2'
        | 'city'
        | 'district'
        | 'state'
        | 'country'
        | 'postalCode'
        | 'timezone'
        | 'remarks'
      >
    >,
  ): Promise<BranchRecord> {
    this.ensureTenantContext(tenantId);
    const normalizedOrganizationId = organizationId?.trim();
    if (!normalizedOrganizationId) throw new ValidationError('Organization ID is required.');
    const name = this.normalizeName(input.name ?? null, 'Branch name');
    return this.repository.createBranch(tenantId, normalizedOrganizationId, {
      code: input.code ?? undefined,
      name,
      status: input.status ?? 'active',
      isHeadOffice: input.isHeadOffice ?? false,
      isDefault: input.isDefault ?? false,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      district: input.district ?? null,
      state: input.state ?? null,
      country: input.country ?? null,
      postalCode: input.postalCode ?? null,
      timezone: input.timezone ?? 'UTC',
      remarks: input.remarks ?? null,
    });
  }

  async listBranches(tenantId: string, organizationId: string): Promise<BranchRecord[]> {
    this.ensureTenantContext(tenantId);
    if (!organizationId || !organizationId.trim()) throw new ValidationError('Organization ID is required.');
    return this.repository.listBranches(tenantId, organizationId.trim());
  }

  async getBranch(tenantId: string, organizationId: string, branchId: string): Promise<BranchRecord | null> {
    this.ensureTenantContext(tenantId);
    if (!organizationId || !organizationId.trim()) throw new ValidationError('Organization ID is required.');
    if (!branchId || !branchId.trim()) throw new ValidationError('Branch ID is required.');
    return this.repository.getBranchById(tenantId, organizationId.trim(), branchId.trim());
  }

  async updateBranch(
    tenantId: string,
    organizationId: string,
    branchId: string,
    changes: Partial<
      Pick<
        BranchRecord,
        | 'code'
        | 'name'
        | 'status'
        | 'isHeadOffice'
        | 'isDefault'
        | 'addressLine1'
        | 'addressLine2'
        | 'city'
        | 'district'
        | 'state'
        | 'country'
        | 'postalCode'
        | 'timezone'
        | 'remarks'
      >
    >,
  ): Promise<BranchRecord | null> {
    this.ensureTenantContext(tenantId);
    if (!organizationId || !organizationId.trim()) throw new ValidationError('Organization ID is required.');
    if (!branchId || !branchId.trim()) throw new ValidationError('Branch ID is required.');
    const payload: Record<string, unknown> = { ...changes };
    if (typeof payload.code === 'string')
      throw new ValidationError('Branch code is generated server-side and cannot be modified.');
    if (typeof payload.name === 'string') payload.name = this.normalizeName(payload.name, 'Branch name');
    return this.repository.updateBranch(
      tenantId,
      organizationId.trim(),
      branchId.trim(),
      payload as Partial<
        Pick<
          BranchRecord,
          | 'code'
          | 'name'
          | 'status'
          | 'isHeadOffice'
          | 'isDefault'
          | 'addressLine1'
          | 'addressLine2'
          | 'city'
          | 'district'
          | 'state'
          | 'country'
          | 'postalCode'
          | 'timezone'
          | 'remarks'
        >
      >,
    );
  }

  async deactivateBranch(tenantId: string, organizationId: string, branchId: string): Promise<boolean> {
    this.ensureTenantContext(tenantId);
    if (!organizationId || !organizationId.trim()) throw new ValidationError('Organization ID is required.');
    if (!branchId || !branchId.trim()) throw new ValidationError('Branch ID is required.');
    return this.repository.deactivateBranch(tenantId, organizationId.trim(), branchId.trim());
  }

  async listUsers(tenantId: string): Promise<UserAdminRecord[]> {
    this.ensureTenantContext(tenantId);
    return this.repository.listUsers(tenantId);
  }

  async getUser(tenantId: string, userId: string): Promise<UserAdminRecord | null> {
    this.ensureTenantContext(tenantId);
    if (!userId || !userId.trim()) throw new ValidationError('User ID is required.');
    return this.repository.getUserById(tenantId, userId.trim());
  }

  async getUserAccess(
    tenantId: string,
    userId: string,
  ): Promise<{ organizations: UserOrganizationAccessRecord[]; branches: UserBranchAccessRecord[] }> {
    this.ensureTenantContext(tenantId);
    if (!userId || !userId.trim()) throw new ValidationError('User ID is required.');
    const normalizedUserId = userId.trim();
    const [organizations, branches] = await Promise.all([
      this.repository.listUserOrganizationAccess(tenantId, normalizedUserId),
      this.repository.listUserBranchAccess(tenantId, normalizedUserId),
    ]);
    return { organizations, branches };
  }

  async updateUser(
    tenantId: string,
    userId: string,
    changes: Partial<
      Pick<
        UserAdminRecord,
        'username' | 'email' | 'organizationId' | 'defaultBranchId' | 'defaultLocationId' | 'status'
      >
    >,
  ): Promise<UserAdminRecord | null> {
    this.ensureTenantContext(tenantId);
    if (!userId || !userId.trim()) throw new ValidationError('User ID is required.');
    const payload: Record<string, unknown> = { ...changes };
    if (typeof payload.username === 'string') {
      payload.username = payload.username.trim();
      if (!payload.username) throw new ValidationError('Username is required.');
    }
    if (typeof payload.email === 'string') {
      payload.email = payload.email.trim().toLowerCase();
      if (!payload.email) throw new ValidationError('Email is required.');
    }
    if (typeof payload.organizationId === 'string' && !payload.organizationId.trim()) payload.organizationId = null;
    if (typeof payload.defaultBranchId === 'string' && !payload.defaultBranchId.trim()) payload.defaultBranchId = null;
    if (typeof payload.defaultLocationId === 'string' && !payload.defaultLocationId.trim())
      payload.defaultLocationId = null;
    return this.repository.updateUser(
      tenantId,
      userId.trim(),
      payload as Partial<
        Pick<
          UserAdminRecord,
          'username' | 'email' | 'organizationId' | 'defaultBranchId' | 'defaultLocationId' | 'status'
        >
      >,
    );
  }

  async assignUserToOrganization(tenantId: string, userId: string, organizationId: string): Promise<boolean> {
    this.ensureTenantContext(tenantId);
    if (!userId || !userId.trim()) throw new ValidationError('User ID is required.');
    if (!organizationId || !organizationId.trim()) throw new ValidationError('Organization ID is required.');
    return this.repository.assignUserToOrganization(tenantId, userId.trim(), organizationId.trim());
  }

  async assignUserToBranch(tenantId: string, userId: string, branchId: string): Promise<boolean> {
    this.ensureTenantContext(tenantId);
    if (!userId || !userId.trim()) throw new ValidationError('User ID is required.');
    if (!branchId || !branchId.trim()) throw new ValidationError('Branch ID is required.');
    return this.repository.assignUserToBranch(tenantId, userId.trim(), branchId.trim());
  }

  async activateUser(tenantId: string, userId: string): Promise<boolean> {
    this.ensureTenantContext(tenantId);
    if (!userId || !userId.trim()) throw new ValidationError('User ID is required.');
    return this.repository.activateUser(tenantId, userId.trim());
  }

  async deactivateUser(tenantId: string, userId: string): Promise<boolean> {
    this.ensureTenantContext(tenantId);
    if (!userId || !userId.trim()) throw new ValidationError('User ID is required.');
    return this.repository.deactivateUser(tenantId, userId.trim());
  }

  async ensureUserCanAccessOrganization(tenantId: string, userId: string, organizationId: string): Promise<boolean> {
    const user = await this.getUser(tenantId, userId);
    if (!user) return false;
    if (user.organizationId && user.organizationId !== organizationId) return false;
    const organization = await this.getOrganization(tenantId, organizationId);
    return Boolean(organization && organization.status === 'active' && !organization.isDeleted);
  }

  generateCode(prefix: string): string {
    const normalizedPrefix =
      (prefix ?? '')
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 6) || 'CODE';
    const next = Math.max(1, Math.floor((Date.now() % 999999) + 1));
    const width = normalizedPrefix.startsWith('BR') ? 3 : 6;
    return `${normalizedPrefix}${String(next).padStart(width, '0')}`;
  }
}
