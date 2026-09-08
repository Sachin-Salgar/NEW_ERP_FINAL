import { ValidationError } from '../../domain/errors.js';
import type { BranchRecord, CoreEnterpriseRepository } from '../../domain/contracts/repositories.js';

export class BranchService {
  constructor(private readonly repository: CoreEnterpriseRepository) {}

  private requireTenant(tenantId: string): void {
    if (!tenantId?.trim()) {
      throw new ValidationError('Tenant context is required for branch operations.');
    }
  }

  async listAccessibleBranchesForUser(
    tenantId: string,
    userId: string,
  ): Promise<BranchRecord[]> {
    this.requireTenant(tenantId);
    const normalizedUserId = (userId ?? '').trim();
    if (!normalizedUserId) {
      throw new ValidationError('User identity is required to list accessible branches.');
    }

    return this.repository.listAccessibleBranchesForUser(tenantId, normalizedUserId);
  }

  async listTenantBranchesForUser(tenantId: string, userId: string): Promise<BranchRecord[]> {
    return this.listAccessibleBranchesForUser(tenantId, userId);
  }

  async getAccessibleBranchByIdForUser(
    tenantId: string,
    userId: string,
    branchId: string,
  ): Promise<BranchRecord | null> {
    this.requireTenant(tenantId);
    const normalizedUserId = (userId ?? '').trim();
    const normalizedBranchId = (branchId ?? '').trim();
    if (!normalizedUserId) {
      throw new ValidationError('User identity is required to resolve a branch.');
    }

    if (!normalizedBranchId) {
      throw new ValidationError('Branch ID is required.');
    }

    return this.repository.getAccessibleBranchByIdForUser(tenantId, normalizedUserId, normalizedBranchId);
  }

  async getTenantBranchByIdForUser(tenantId: string, userId: string, branchId: string): Promise<BranchRecord | null> {
    return this.getAccessibleBranchByIdForUser(tenantId, userId, branchId);
  }

  async validateBranchAccess(
    tenantId: string,
    userId: string,
    branchId: string,
  ): Promise<boolean> {
    this.requireTenant(tenantId);
    const normalizedUserId = (userId ?? '').trim();
    const normalizedBranchId = (branchId ?? '').trim();
    if (!normalizedUserId || !normalizedBranchId) {
      return false;
    }
    return this.repository.validateBranchAccess(tenantId, normalizedUserId, normalizedBranchId);
  }

  async getBranchById(tenantId: string, branchId: string): Promise<BranchRecord | null> {
    this.requireTenant(tenantId);
    const normalizedId = (branchId ?? '').trim();
    if (!normalizedId) {
      throw new ValidationError('Branch ID is required.');
    }
    return this.repository.getBranchById(tenantId, normalizedId);
  }

  async validateFinancialYear(tenantId: string, financialYearId: string): Promise<boolean> {
    if (!tenantId?.trim() || !financialYearId?.trim()) return false;
    return this.repository.validateFinancialYear(tenantId, financialYearId);
  }
}
