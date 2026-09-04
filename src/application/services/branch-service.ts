import { ValidationError } from '../../domain/errors.js';
import type { BranchRecord, CoreEnterpriseRepository } from '../../domain/contracts/repositories.js';

export class BranchService {
  constructor(private readonly repository: CoreEnterpriseRepository) {}

  private requireTenant(tenantId: string): void {
    if (!tenantId?.trim()) {
      throw new ValidationError('Tenant context is required for branch operations.');
    }
  }

  private requireContext(tenantId: string, organizationId: string): void {
    this.requireTenant(tenantId);
    if (!organizationId?.trim()) {
      throw new ValidationError('Organization context is required for branch operations.');
    }
  }

  async listAccessibleBranchesForUser(tenantId: string, userId: string, organizationId?: string | null): Promise<BranchRecord[]> {
    this.requireTenant(tenantId);
    const normalizedUserId = (userId ?? '').trim();
    if (!normalizedUserId) {
      throw new ValidationError('User identity is required to list accessible branches.');
    }
    return this.repository.listAccessibleBranchesForUser(tenantId, normalizedUserId, organizationId ?? null);
  }

  async getAccessibleBranchByIdForUser(tenantId: string, userId: string, branchId: string, organizationId?: string | null): Promise<BranchRecord | null> {
    this.requireTenant(tenantId);
    const normalizedUserId = (userId ?? '').trim();
    const normalizedBranchId = (branchId ?? '').trim();
    if (!normalizedUserId) {
      throw new ValidationError('User identity is required to resolve a branch.');
    }
    if (!normalizedBranchId) {
      throw new ValidationError('Branch ID is required.');
    }
    return this.repository.getAccessibleBranchByIdForUser(tenantId, normalizedUserId, normalizedBranchId, organizationId ?? null);
  }

  async validateBranchAccess(tenantId: string, userId: string, branchId: string, organizationId?: string | null): Promise<boolean> {
    this.requireTenant(tenantId);
    const normalizedUserId = (userId ?? '').trim();
    const normalizedBranchId = (branchId ?? '').trim();
    if (!normalizedUserId || !normalizedBranchId) {
      return false;
    }
    return this.repository.validateBranchAccess(tenantId, normalizedUserId, normalizedBranchId, organizationId ?? null);
  }

  async getBranchById(tenantId: string, organizationId: string, branchId: string): Promise<BranchRecord | null> {
    this.requireContext(tenantId, organizationId);
    const normalizedId = (branchId ?? '').trim();
    if (!normalizedId) {
      throw new ValidationError('Branch ID is required.');
    }
    return this.repository.getBranchById(tenantId, organizationId, normalizedId);
  }
}
