import { describe, expect, it, vi } from 'vitest';

import { PostgresAuditLogger, filterMetadata } from '../../src/infrastructure/audit/postgres-audit-logger.js';
import { runInTransactionContext } from '../../src/infrastructure/database/transaction-context.js';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

function createMockClient() {
  return {
    query: vi.fn(async () => ({ rows: [], rowCount: 1 })),
    release: vi.fn(),
  };
}

describe('PostgresAuditLogger', () => {
  it('rejects required transactional audit records outside an active transaction', async () => {
    const pool = { connect: vi.fn() };
    const logger = new PostgresAuditLogger(pool as never, {
      tenantContextKey: 'app.current_tenant_id',
    });

    await expect(
      logger.record(
        {
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          action: 'auth.password.changed',
          resourceType: 'user',
          resourceId: USER_ID,
          outcome: 'success',
        },
        { requireTransaction: true },
      ),
    ).rejects.toThrow('requires an active transaction');
  });

  it('reuses the active transaction client for a tenant-scoped audit insert', async () => {
    const client = createMockClient();
    const pool = { connect: vi.fn() };
    const logger = new PostgresAuditLogger(pool as never, {
      tenantContextKey: 'app.current_tenant_id',
      allowedMetadataKeys: ['reason'],
    });

    await runInTransactionContext(client as never, async () => {
      await logger.record(
        {
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          action: 'user.role.assigned',
          resourceType: 'user',
          resourceId: USER_ID,
          outcome: 'success',
          correlationId: 'corr-123',
          metadata: {
            reason: 'approved',
            password: 'must-not-be-recorded',
          },
        },
        { requireTransaction: true },
      );
    });

    expect(pool.connect).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('SET LOCAL "app.current_tenant_id"'),
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_events'),
      [
        TENANT_ID,
        USER_ID,
        'user.role.assigned',
        'user',
        USER_ID,
        'success',
        'corr-123',
        JSON.stringify({ reason: 'approved' }),
      ],
    );
  });
});

describe('filterMetadata', () => {
  it('keeps only explicitly allowed metadata keys', () => {
    expect(
      filterMetadata(
        {
          reason: 'approved',
          attempts: 2,
          password: 'secret',
          token: 'secret-token',
        },
        new Set(['reason', 'attempts']),
      ),
    ).toEqual({ reason: 'approved', attempts: 2 });
  });

  it('records no metadata when no keys are allowlisted', () => {
    expect(filterMetadata({ safe: true }, new Set())).toEqual({});
  });
});
