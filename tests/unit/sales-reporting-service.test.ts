import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SalesReportingService } from '../../src/application/services/sales-reporting-service.js';
import type { SalesReportRepository } from '../../src/domain/contracts/sales-reporting.js';
import { ForbiddenError } from '../../src/domain/errors.js';

const context = {
  tenantId: randomUUID(),
  organizationId: randomUUID(),
  branchId: randomUUID(),
  financialYearId: randomUUID(),
  userId: randomUUID(),
};

class Repository implements SalesReportRepository {
  async listDocumentSummary() {
    return { items: [], total: 0 };
  }
}

describe('SalesReportingService', () => {
  it('enforces permission and module access before querying', async () => {
    const service = new SalesReportingService(
      new Repository(),
      { hasPermission: async () => false },
      { isModuleEnabled: async () => true },
    );
    await expect(service.listDocumentSummary(context, { page: 1, pageSize: 20, order: 'desc' }))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  it('returns the bounded document summary query result', async () => {
    const service = new SalesReportingService(
      new Repository(),
      { hasPermission: async () => true },
      { isModuleEnabled: async () => true },
    );
    await expect(service.listDocumentSummary(context, { page: 1, pageSize: 20, order: 'desc' }))
      .resolves.toEqual({ items: [], total: 0 });
  });
});
