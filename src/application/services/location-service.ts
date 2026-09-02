import { ValidationError } from '../../domain/errors.js';
import type { CoreEnterpriseRepository, LocationRecord } from '../contracts/security.js';

export class LocationService {
  constructor(private readonly repository: CoreEnterpriseRepository) {}

  private requireTenant(tenantId: string): void {
    if (!tenantId?.trim()) {
      throw new ValidationError('Tenant context is required for location operations.');
    }
  }

  private requireContext(tenantId: string, organizationId: string): void {
    this.requireTenant(tenantId);
    if (!organizationId?.trim()) {
      throw new ValidationError('Organization context is required for location operations.');
    }
  }

  private normalizeCode(value: string | undefined, label: string): string {
    const normalized = (value ?? '').trim();
    if (!normalized) {
      throw new ValidationError(`${label} is required.`);
    }
    return normalized;
  }

  async createLocation(
    tenantId: string,
    organizationId: string,
    input: { code?: string; name: string; description?: string | null; status?: 'active' | 'inactive' | 'archived'; isDefault?: boolean; addressLine1?: string | null; addressLine2?: string | null; city?: string | null; state?: string | null; country?: string | null; postalCode?: string | null; timezone?: string },
  ): Promise<LocationRecord> {
    this.requireContext(tenantId, organizationId);
    const name = this.normalizeCode(input.name, 'Location name');
    const code = await this.repository.generateLocationCode(tenantId, organizationId);

    return this.repository.createLocation(tenantId, organizationId, {
      code,
      name,
      description: input.description ?? null,
      status: input.status ?? 'active',
      isDefault: input.isDefault ?? false,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      country: input.country ?? null,
      postalCode: input.postalCode ?? null,
      timezone: input.timezone ?? 'UTC',
    });
  }

  async listLocations(tenantId: string, organizationId: string): Promise<LocationRecord[]> {
    this.requireContext(tenantId, organizationId);
    return this.repository.listLocations(tenantId, organizationId);
  }

  async listAccessibleLocationsForUser(tenantId: string, userId: string, organizationId?: string | null): Promise<LocationRecord[]> {
    this.requireTenant(tenantId);
    const normalizedUserId = (userId ?? '').trim();
    if (!normalizedUserId) {
      throw new ValidationError('User identity is required to list accessible locations.');
    }
    return this.repository.listAccessibleLocationsForUser(tenantId, normalizedUserId, organizationId ?? null);
  }

  async getLocationById(tenantId: string, organizationId: string, locationId: string): Promise<LocationRecord | null> {
    this.requireContext(tenantId, organizationId);
    const normalizedId = (locationId ?? '').trim();
    if (!normalizedId) {
      throw new ValidationError('Location ID is required.');
    }
    return this.repository.getLocationById(tenantId, organizationId, normalizedId);
  }

  async getAccessibleLocationByIdForUser(tenantId: string, userId: string, locationId: string, organizationId?: string | null): Promise<LocationRecord | null> {
    this.requireTenant(tenantId);
    const normalizedUserId = (userId ?? '').trim();
    const normalizedLocationId = (locationId ?? '').trim();
    if (!normalizedUserId) {
      throw new ValidationError('User identity is required to resolve a location.');
    }
    if (!normalizedLocationId) {
      throw new ValidationError('Location ID is required.');
    }
    return this.repository.getAccessibleLocationByIdForUser(tenantId, normalizedUserId, normalizedLocationId, organizationId ?? null);
  }

  async validateLocationAccess(tenantId: string, userId: string, locationId: string, organizationId?: string | null): Promise<boolean> {
    this.requireTenant(tenantId);
    const normalizedUserId = (userId ?? '').trim();
    const normalizedLocationId = (locationId ?? '').trim();
    if (!normalizedUserId || !normalizedLocationId) {
      return false;
    }
    return this.repository.validateLocationAccess(tenantId, normalizedUserId, normalizedLocationId, organizationId ?? null);
  }

  async updateLocation(
    tenantId: string,
    organizationId: string,
    locationId: string,
    changes: Partial<Pick<LocationRecord, 'code' | 'name' | 'description' | 'status' | 'isDefault' | 'addressLine1' | 'addressLine2' | 'city' | 'state' | 'country' | 'postalCode' | 'timezone'>>,
  ): Promise<LocationRecord | null> {
    this.requireContext(tenantId, organizationId);
    const normalizedId = (locationId ?? '').trim();
    if (!normalizedId) {
      throw new ValidationError('Location ID is required.');
    }
    const normalizedChanges = { ...changes };
    if (normalizedChanges.code !== undefined) {
      throw new ValidationError('Location code is generated server-side and cannot be modified.');
    }
    if (normalizedChanges.name !== undefined) {
      normalizedChanges.name = this.normalizeCode(normalizedChanges.name, 'Location name');
    }
    return this.repository.updateLocation(tenantId, organizationId, normalizedId, normalizedChanges);
  }

  async deactivateLocation(tenantId: string, organizationId: string, locationId: string): Promise<boolean> {
    this.requireContext(tenantId, organizationId);
    const normalizedId = (locationId ?? '').trim();
    if (!normalizedId) {
      throw new ValidationError('Location ID is required.');
    }
    return this.repository.deactivateLocation(tenantId, organizationId, normalizedId);
  }
}
