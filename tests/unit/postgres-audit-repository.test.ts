import { describe, expect, it, vi } from 'vitest';

import { PostgresAuditRepository } from '../../src/infrastructure/database/repositories/postgres-audit-repository.js';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';

describe('PostgresAuditRepository', () => {
  it('applies filters and uses timestamp/id ordering with server-side pagination', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '1' }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              tenantId: TENANT_ID,
              actorUserId: null,
              action: 'customer.created',
              resourceType: 'customer',
              resourceId: 'customer-1',
              outcome: 'success',
              correlationId: 'corr-1',
              metadata: {},
              createdAt: '2026-09-12T00:00:00.000Z',
            },
          ],
        })
        .mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn(async () => client) };
    const repository = new PostgresAuditRepository(pool as never);

    const result = await repository.list(TENANT_ID, {
      page: 2,
      pageSize: 10,
      order: 'desc',
      action: 'customer.created',
      resourceType: 'customer',
      from: new Date('2026-09-01T00:00:00.000Z'),
      to: new Date('2026-09-12T00:00:00.000Z'),
    });

    expect(result.items[0]?.action).toBe('customer.created');
    const rowQuery = client.query.mock.calls.find(([sql]) => String(sql).includes('ORDER BY created_at'));
    expect(rowQuery?.[0]).toContain('tenant_id = $1');
    expect(rowQuery?.[0]).toContain('action = $2');
    expect(rowQuery?.[0]).toContain('resource_type = $3');
    expect(rowQuery?.[0]).toContain('created_at >= $4');
    expect(rowQuery?.[0]).toContain('created_at <= $5');
    expect(rowQuery?.[0]).toContain('ORDER BY created_at DESC, id DESC');
    expect(rowQuery?.[1]).toEqual([
      TENANT_ID,
      'customer.created',
      'customer',
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2026-09-12T00:00:00.000Z'),
      10,
      10,
    ]);
  });
});
