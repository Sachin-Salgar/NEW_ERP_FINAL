import { describe, expect, it, vi } from 'vitest';

import { AuditQueryService } from '../../src/application/services/audit-query-service.js';
import type { AuditRepository } from '../../src/application/contracts/audit.js';

const context = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
};

function createService(repository: AuditRepository = { list: vi.fn(async () => ({ items: [], total: 0 })) }) {
  const service = new AuditQueryService(
    repository,
    { hasPermission: vi.fn(async () => true) },
    { isModuleEnabled: vi.fn(async () => true) },
  );
  return { service, repository };
}

describe('AuditQueryService', () => {
  it('authorizes and forwards supported filters and pagination', async () => {
    const repository: AuditRepository = {
      list: vi.fn(async () => ({ items: [], total: 0 })),
    };
    const { service } = createService(repository);
    const from = new Date('2026-09-01T00:00:00.000Z');
    const to = new Date('2026-09-12T00:00:00.000Z');

    await expect(
      service.list(context, {
        page: 2,
        pageSize: 10,
        order: 'desc',
        actorUserId: context.userId,
        action: 'customer.created',
        resourceType: 'customer',
        resourceId: 'customer-1',
        from,
        to,
        correlationId: 'corr-1',
      }),
    ).resolves.toEqual({ items: [], total: 0 });

    expect(repository.list).toHaveBeenCalledWith(context.tenantId, {
      page: 2,
      pageSize: 10,
      order: 'desc',
      actorUserId: context.userId,
      action: 'customer.created',
      resourceType: 'customer',
      resourceId: 'customer-1',
      from,
      to,
      correlationId: 'corr-1',
    });
  });

  it('rejects invalid ranges and page sizes', async () => {
    const { service } = createService();

    await expect(
      service.list(context, {
        page: 1,
        pageSize: 101,
        order: 'desc',
      }),
    ).rejects.toThrow('page_size must be between 1 and 100.');

    await expect(
      service.list(context, {
        page: 1,
        pageSize: 20,
        order: 'desc',
        from: new Date('2026-09-12T00:00:00.000Z'),
        to: new Date('2026-09-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow('from must be earlier');
  });

  it('rejects unauthorized users before querying the repository', async () => {
    const repository: AuditRepository = { list: vi.fn(async () => ({ items: [], total: 0 })) };
    const service = new AuditQueryService(
      repository,
      { hasPermission: vi.fn(async () => false) },
      { isModuleEnabled: vi.fn(async () => true) },
    );

    await expect(service.list(context, { page: 1, pageSize: 20, order: 'desc' })).rejects.toThrow('Permission denied.');
    expect(repository.list).not.toHaveBeenCalled();
  });
});
