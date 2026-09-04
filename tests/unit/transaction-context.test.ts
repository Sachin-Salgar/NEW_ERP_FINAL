import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';

import { UnitOfWork } from '../../src/infrastructure/database/unit-of-work.js';
import { withTenantContext } from '../../src/infrastructure/database/tenant-context.js';

function createMockPool() {
  const query = vi.fn(async (..._args: unknown[]) => ({ rows: [] }));
  const release = vi.fn();
  const client = { query, release } as unknown as PoolClient;
  const connect = vi.fn(async () => client);
  return { pool: { connect } as never, client, query, release, connect };
}

describe('transaction context and tenant RLS boundary', () => {
  it('reuses the service transaction client instead of starting a nested transaction', async () => {
    const mock = createMockPool();
    const uow = new UnitOfWork(mock.pool);
    const tenantId = 'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1001';

    await uow.runInTransaction(async () => {
      await withTenantContext(mock.pool, 'app.current_tenant_id', tenantId, async (scopedClient) => {
        expect(scopedClient).toBe(mock.client);
      });
    });

    expect(mock.connect).toHaveBeenCalledTimes(1);
    expect(mock.query).toHaveBeenCalledWith('BEGIN');
    expect(mock.query).toHaveBeenCalledWith('COMMIT');
    expect(mock.query.mock.calls.filter(([sql]) => sql === 'BEGIN')).toHaveLength(1);
    expect(mock.query.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(1);
  });

  it('rejects switching tenants inside one service transaction', async () => {
    const mock = createMockPool();
    const uow = new UnitOfWork(mock.pool);
    const tenantA = 'a7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1001';
    const tenantB = 'b7f2f4b0-2f11-4d2f-9a8a-4d7d9b2e1001';

    await expect(uow.runInTransaction(async () => {
      await withTenantContext(mock.pool, 'app.current_tenant_id', tenantA, async () => undefined);
      await withTenantContext(mock.pool, 'app.current_tenant_id', tenantB, async () => undefined);
    })).rejects.toThrow('transaction cannot be reused across tenant contexts');

    expect(mock.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
